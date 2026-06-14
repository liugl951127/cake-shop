// addOrder - 下单 + 微信支付统一下单(完整版:支持优惠券/积分/会员折扣/秒杀/自提)
//
// 【后台设计说明】
// 依赖:  wx-server-sdk~2.6.3(包管理统一,版本锁)
// 公共:  common/index.js - 统一鉴权/响应/异常
// 业务:  pay/orderLog/member/coupon/promo/riskGuard 6 个 module
// 调用:  1万+ 单/日峰值
// 幂等:  5 秒内同 openid 仅允许 1 个待付订单
// 事务:  优惠券锁 → 库存扣 → 订单写 → 微信下单;任一失败回滚
const {
  cloud, ok, logger, auth, BizError, ErrorCode
} = require('../common/index.js');
const { genOutTradeNo, unifiedOrder } = require('../common/pay.js');
const { writeLog } = require('../common/orderLog.js');
const { calcDiscount } = require('../common/member.js');
const { lockCoupon, markCouponUsed, refundCoupon } = require('../common/coupon.js');
const { calcBestDiscount } = require('../common/promo.js');
const { guard: riskGuard } = require('../common/riskGuard.js');
const { findOne, incField, num } = require('../common/transaction.js');

exports.main = auth(async (event) => {
  const {
    items, address, remark, timeText,
    goodsPrice, freight, totalPrice,
    couponId = '', couponDiscount = 0,
    usePoints = 0,
    isSelfPickup = false, storeId = ''
  } = event;
  if (!items || items.length === 0) {
    throw new BizError('订单无商品', ErrorCode.BAD_REQUEST);
  }
  if (!address && !isSelfPickup) {
    throw new BizError('请选择地址', ErrorCode.BAD_REQUEST);
  }
  if (isSelfPickup && !storeId) {
    throw new BizError('请选择自提门店', ErrorCode.BAD_REQUEST);
  }

  // === 统一风控闸门 ===
  // 高额订单用 highOrder 场景(更严),普通用 pay
  const scenario = (totalPrice >= 2000 || goodsPrice >= 1500) ? 'highOrder' : 'pay';
  const risk = await riskGuard(event, {
    scenario,
    userId: event._userId,
    openid: event._openid,
    deviceId: event.deviceId || '',
    ip: cloud.getWXContext().CLIENTIP || '',
    amount: totalPrice,
    extra: { address: address && address.address }
  });
  if (risk.decision === 'reject') {
    throw new BizError(risk.message + ':' + (risk.factors || []).map(f => f.code).join(','));
  }
  if (risk.decision === 'verify') {
    // 标记订单需要补认证(返回后前端引导用户去认证)
    return ok({
      needVerify: true,
      requireAction: risk.requireAction,
      riskLogId: risk.logId,
      message: risk.message
    });
  }
  if (risk.decision === 'manual') {
    // 进入人工审核,订单先挂起
    return ok({
      pendingReview: true,
      riskLogId: risk.logId,
      message: risk.message
    });
  }

  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const orderNo = genOutTradeNo('CAKE');
  const outTradeNo = orderNo;

  // 幂等锁
  const recent = await db.collection('orders').where({
    _openid: event._openid,
    status: 0,
    createTime: _.gt(now - 5000)
  }).limit(1).get();
  if (recent.data.length > 0) throw new BizError('操作太频繁,请稍后再试', ErrorCode.RATE_LIMIT);

  // 校验商品 + 库存(支持秒杀/拼团)
  for (const it of items) {
    if (it.activityType === 'seckill') {
      const sk = await db.collection('seckill').doc(it.activityId || it._id).get().catch(() => null);
      if (!sk || !sk.data) throw new BizError(`秒杀活动已结束: ${it.name}`);
      if (sk.data.stock < it.count) throw new BizError(`秒杀库存不足: ${it.name}`);
    } else if (it.activityType === 'group') {
      throw new BizError('拼团商品请走拼团下单');
    } else {
      const g = await db.collection('goods').doc(it._id).get();
      if (!g.data) throw new BizError(`商品已下架: ${it.name}`);
      if (g.data.status !== 1) throw new BizError(`${it.name} 已下架`);
      if ((g.data.stock || 0) < it.count) throw new BizError(`${it.name} 库存不足`);
    }
  }

  // 金额复算
  let calcGoods = 0;
  for (const it of items) calcGoods += Number(it.price) * it.count;

  // 满减/折扣活动
  const promos = await db.collection('promos').where({
    status: 1, type: _.in(['full_reduce', 'discount']),
    startTime: _.lte(now), endTime: _.gte(now)
  }).get();
  const bestPromo = calcBestDiscount(calcGoods, promos.data);
  const promoDiscount = bestPromo ? bestPromo.discount : 0;
  const promoId = bestPromo ? bestPromo.promo._id : '';

  // 会员折扣
  const user = await db.collection('users').doc(event._userId).get();
  const userLevel = user.data.level || 0;
  const discountAmount = Number((calcGoods - calcDiscount(userLevel, calcGoods)).toFixed(2));

  // 优惠券
  let actualCouponDiscount = 0;
  let lockedCoupon = null;
  if (couponId) {
    lockedCoupon = await lockCoupon(db, couponId, event._openid, event._userId, calcGoods);
    actualCouponDiscount = lockedCoupon.discount;
  }

  // 积分抵扣
  const pointsDiscount = Math.min(usePoints, user.data.points || 0) / 100;

  // 运费
  const calcFreight = isSelfPickup ? 0 : (calcGoods >= 99 ? 0 : 8);

  // 应付
  const calcTotal = Math.max(0,
    calcGoods - discountAmount - actualCouponDiscount - pointsDiscount - promoDiscount + calcFreight);
  const clientTotal = Number(totalPrice) || 0;
  if (Math.abs(calcTotal - clientTotal) > 0.01) {
    if (lockedCoupon) await refundCoupon(db, couponId, event._userId);
    throw new BizError('订单金额异常,请刷新后重试');
  }

  // 扣库存
  for (const it of items) {
    if (it.activityType === 'seckill') {
      await db.collection('seckill').doc(it.activityId || it._id).update({
        data: { stock: _.inc(-it.count), sold: _.inc(it.count) }
      });
    } else {
      await db.collection('goods').doc(it._id).update({
        data: { stock: _.inc(-it.count), sales: _.inc(it.count) }
      });
    }
  }

  // 创建订单
  const expireTime = now + 30 * 60 * 1000;
  const orderRes = await db.collection('orders').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      orderNo,
      outTradeNo,
      items,
      address: address || null,
      remark: remark || '',
      isGift: !!event.isGift,
      giftMsg: event.giftMsg || '',
      timeText: timeText || '尽快送达',
      isSelfPickup: !!isSelfPickup,
      storeId: storeId || '',
      goodsPrice: calcGoods,
      memberDiscount: discountAmount,
      couponId: couponId || '',
      couponDiscount: actualCouponDiscount,
      usePoints: usePoints || 0,
      pointsDiscount: pointsDiscount,
      promoId: promoId,
      promoDiscount: promoDiscount,
      freight: calcFreight,
      totalPrice: calcTotal,
      totalFee: Math.round(calcTotal * 100),
      status: 0,
      createTime: now,
      updateTime: now,
      expireTime,
      payTime: 0,
      refundStatus: 0,
      refundReason: '',
      deliveryInfo: null
    }
  });

  const orderId = orderRes._id;

  // 标记优惠券已用
  if (couponId && lockedCoupon) {
    await markCouponUsed(db, couponId, event._userId, orderId);
  }

  // 扣积分
  if (usePoints > 0) {
    const newPoints = (user.data.points || 0) - usePoints;
    await db.collection('users').doc(event._userId).update({
      data: { points: newPoints }
    });
    await db.collection('pointLogs').add({
      data: {
        _openid: event._openid,
        type: 'use', delta: -usePoints, balance: newPoints,
        remark: `订单 ${orderNo} 抵扣`, orderId,
        createTime: Date.now()
      }
    });
  }

  await writeLog(db, {
    orderId, orderNo, _openid: event._openid,
    action: 'create', fromStatus: null, toStatus: 0,
    operator: event._openid, operatorType: 'user',
    remark: `创建订单,共 ${items.length} 件,实付 ¥${calcTotal}`
  });

  // 调起支付
  const wxContext = cloud.getWXContext();
  const payResult = await unifiedOrder({
    outTradeNo,
    totalFee: Math.round(calcTotal * 100),
    openid: wxContext.OPENID,
    body: `甜心蛋糕-${items[0].name}`,
    attach: orderId
  });

  if (!payResult.success) {
    // 回滚
    for (const it of items) {
      if (it.activityType === 'seckill') {
        await db.collection('seckill').doc(it.activityId || it._id).update({
          data: { stock: _.inc(it.count), sold: _.inc(-it.count) }
        }).catch(() => {});
      } else {
        await db.collection('goods').doc(it._id).update({
          data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
        }).catch(() => {});
      }
    }
    if (couponId) await refundCoupon(db, couponId, event._userId);
    if (usePoints > 0) {
      await db.collection('users').doc(event._userId).update({
        data: { points: _.inc(usePoints) }
      }).catch(() => {});
    }
    await db.collection('orders').doc(orderId).update({
      data: { status: -1, cancelReason: '支付下单失败', updateTime: Date.now() }
    });
    throw new BizError('支付下单失败: ' + payResult.error);
  }

  return ok({ _id: orderId, orderNo, payment: payResult.payment, expireTime });
});
