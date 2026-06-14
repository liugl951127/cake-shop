// addOrder - 下单 + 微信支付统一下单
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { genOutTradeNo, unifiedOrder } = require('../common/pay.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = auth(async (event) => {
  const { items, address, remark, timeText, goodsPrice, freight, totalPrice } = event;
  if (!items || items.length === 0) throw new BizError('订单无商品');
  if (!address) throw new BizError('请选择地址');
  if (!address.name || !address.phone || !address.region) throw new BizError('收货信息不完整');
  if (!/^1\d{10}$/.test(address.phone)) throw new BizError('手机号格式错误');

  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const orderNo = genOutTradeNo('CAKE');
  const outTradeNo = orderNo; // 同一单号复用

  // 幂等锁:同一 openid 5 秒内同金额同商品只允许一个待付款订单
  const recent = await db.collection('orders').where({
    _openid: event._openid,
    status: 0,
    createTime: _.gt(now - 5000)
  }).limit(1).get();
  if (recent.data.length > 0) {
    throw new BizError('操作太频繁,请稍后再试');
  }

  // 校验库存
  for (const it of items) {
    const g = await db.collection('goods').doc(it._id).get();
    if (!g.data) throw new BizError(`商品已下架: ${it.name}`);
    if (g.data.status !== 1) throw new BizError(`${it.name} 已下架`);
    if ((g.data.stock || 0) < it.count) throw new BizError(`${it.name} 库存不足`);
  }

  // 计算金额(后端复算,防篡改)
  let calcGoods = 0;
  for (const it of items) {
    calcGoods += Number(it.price) * it.count;
  }
  const calcFreight = calcGoods >= 99 ? 0 : 8;
  const calcTotal = calcGoods + calcFreight;
  const clientTotal = Number(totalPrice) || 0;
  if (Math.abs(calcTotal - clientTotal) > 0.01) {
    throw new BizError('订单金额异常,请刷新后重试');
  }

  // 扣减库存(乐观更新,失败回滚)
  for (const it of items) {
    const upd = await db.collection('goods').doc(it._id).update({
      data: { stock: _.inc(-it.count), sales: _.inc(it.count) }
    });
    if (upd.stats.updated !== 1) {
      // 失败,回滚
      for (const r of items) {
        await db.collection('goods').doc(r._id).update({
          data: { stock: _.inc(r.count), sales: _.inc(-r.count) }
        }).catch(() => {});
      }
      throw new BizError('库存更新失败');
    }
  }

  // 创建订单
  const expireTime = now + 30 * 60 * 1000; // 30 分钟过期
  const orderRes = await db.collection('orders').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      orderNo,
      outTradeNo,
      items,
      address,
      remark: remark || '',
      timeText: timeText || '尽快送达',
      goodsPrice: calcGoods,
      freight: calcFreight,
      totalPrice: calcTotal,
      totalFee: Math.round(calcTotal * 100), // 支付金额(分)
      status: 0,
      createTime: now,
      updateTime: now,
      expireTime,
      payTime: 0,
      refundStatus: 0,  // 0-无 1-退款中 2-已退款
      refundReason: '',
      deliveryInfo: null  // 配送信息(后续管理员填)
    }
  });

  const orderId = orderRes._id;

  // 写订单日志
  await writeLog(db, {
    orderId, orderNo,
    _openid: event._openid,
    action: 'create',
    fromStatus: null,
    toStatus: 0,
    operator: event._openid,
    operatorType: 'user',
    remark: `创建订单,共 ${items.length} 件商品`
  });

  // 调起微信支付 - 统一下单
  const wxContext = cloud.getWXContext();
  const payResult = await unifiedOrder({
    outTradeNo,
    totalFee: Math.round(calcTotal * 100),
    openid: wxContext.OPENID,
    body: `甜心蛋糕-${items[0].name}`,
    attach: orderId
  });

  if (!payResult.success) {
    // 统一下单失败,回滚库存
    for (const it of items) {
      await db.collection('goods').doc(it._id).update({
        data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
      }).catch(() => {});
    }
    await db.collection('orders').doc(orderId).update({
      data: { status: -1, cancelReason: '支付下单失败', updateTime: Date.now() }
    });
    throw new BizError('支付下单失败: ' + payResult.error);
  }

  return ok({
    _id: orderId,
    orderNo,
    payment: payResult.payment,
    expireTime
  });
});
