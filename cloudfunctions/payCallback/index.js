// payCallback - 微信支付回调(云开发模式)
const { cloud, ok } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');
const member = require('../common/member.js');
const { send: sendSubMsg } = require('../common/subscribeMessage.js');

/**
 * 微信支付回调入口
 * 文档:https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/openapi/cloud-pay/
 *
 * 该云函数被 cloud.cloudPay.unifiedOrder 引用,
 * 微信支付完成后,微信服务器会主动调用此函数
 *
 * 关键点:
 * 1. 必须返回 { errcode: 0 } 微信才认为回调成功
 * 2. 同一回调可能重复到达,必须做幂等
 * 3. 验签 + 校验金额,防止伪造
 */
exports.main = async (event) => {
  const db = cloud.database();
  const _ = db.command;
  console.log('[payCallback] 收到回调:', JSON.stringify(event));

  // 退款回调
  if (event.refund_fee !== undefined) {
    return handleRefund(event, db, _);
  }

  // 支付成功回调
  if (event.return_code === 'SUCCESS' && event.result_code === 'SUCCESS') {
    return handlePaySuccess(event, db, _);
  }

  // 支付失败
  if (event.return_code === 'SUCCESS' && event.result_code === 'FAIL') {
    return handlePayFail(event, db, _);
  }

  return { errcode: 0, errmsg: 'OK' };
};

async function handlePaySuccess(event, db, _) {
  const { out_trade_no, transaction_id, total_fee, openid } = event;
  if (!out_trade_no) return { errcode: 0, errmsg: 'OK' };

  // 幂等:同一 out_trade_no 多次回调只处理一次
  const order = await db.collection('orders').where({ outTradeNo: out_trade_no }).limit(1).get();
  if (!order.data[0]) {
    console.warn('[payCallback] 订单不存在:', out_trade_no);
    return { errcode: 0, errmsg: 'OK' };
  }
  const o = order.data[0];

  // 已处理过,直接返回成功
  if (o.status >= 1 && o.payTime) {
    return { errcode: 0, errmsg: 'OK' };
  }

  // 校验金额(防伪造)
  if (Number(total_fee) !== Number(o.totalFee)) {
    console.error('[payCallback] 金额不一致:', total_fee, '!=', o.totalFee);
    return { errcode: 0, errmsg: 'AMOUNT_ERROR' };
  }

  // 更新订单为已付款
  await db.collection('orders').doc(o._id).update({
    data: {
      status: 1,
      payTime: Date.now(),
      transactionId: transaction_id || '',
      updateTime: Date.now()
    }
  });

  await writeLog(db, {
    orderId: o._id,
    orderNo: o.orderNo,
    _openid: openid,
    action: 'pay',
    fromStatus: 0,
    toStatus: 1,
    operator: openid,
    operatorType: 'user',
    remark: `支付成功,微信流水号: ${transaction_id || '-'}`
  });

  // 会员成长值 + 积分 + 首单邀请裂变奖励
  if (o._userId) {
    const user = await db.collection('users').doc(o._userId).get().catch(() => null);
    if (user && user.data) {
      const newExp = (user.data.exp || 0) + Math.floor(o.totalPrice);
      const newPoints = (user.data.points || 0) + Math.floor(o.totalPrice);
      const newLevel = member.getLevel(newExp).level;
      const orderCount = (user.data.orderCount || 0) + 1;
      const isFirstOrder = orderCount === 1;
      const updateData = { exp: newExp, points: newPoints, level: newLevel, orderCount, updateTime: Date.now() };

      // 首单奖励 + 邀请人奖励
      if (isFirstOrder && !user.data.firstOrderRewarded) {
        updateData.points = newPoints + 50;  // 自己 +50
        updateData.firstOrderRewarded = true;

        // 写自己的积分流水
        await db.collection('pointLogs').add({
          data: {
            _openid: o._openid, type: 'first_order', delta: 50,
            balance: newPoints + 50,
            remark: '首单奖励 50 积分', orderId: o._id, createTime: now
          }
        });

        // 发首单优惠券
        const couponTpl = await db.collection('coupons').where({ type: 3, status: 1 }).limit(1).get();
        if (couponTpl.data[0]) {
          await db.collection('couponUsers').add({
            data: {
              _openid: o._openid, _userId: o._userId,
              couponId: couponTpl.data[0]._id, status: 0,
              receiveTime: now, expireTime: now + 30 * 86400000,
              fromFirstOrder: true
            }
          }).catch(() => {});
        }

        // 邀请人奖励
        if (user.data.inviterOpenid) {
          const inviter = await db.collection('users').where({ openid: user.data.inviterOpenid }).limit(1).get();
          if (inviter.data[0]) {
            const inv = inviter.data[0];
            const invNewPoints = (inv.points || 0) + 100;
            await db.collection('users').doc(inv._id).update({
              data: { points: invNewPoints, inviteCount: (inv.inviteCount || 0) + 1, updateTime: now }
            });
            await db.collection('pointLogs').add({
              data: {
                _openid: inv.openid, _userId: inv._id,
                type: 'invite', delta: 100, balance: invNewPoints,
                remark: `邀请好友首单奖励,好友: ${user.data.nickName || '匿名'}`,
                orderId: o._id, createTime: now
              }
            });
            // 给邀请人也发张券
            const invCoupon = await db.collection('coupons').where({ type: 1, minAmount: 0, status: 1 }).limit(1).get();
            if (invCoupon.data[0]) {
              await db.collection('couponUsers').add({
                data: {
                  _openid: inv.openid, _userId: inv._id,
                  couponId: invCoupon.data[0]._id, status: 0,
                  receiveTime: now, expireTime: now + 30 * 86400000,
                  fromInvite: true
                }
              }).catch(() => {});
            }
          }
        }
      }

      await db.collection('users').doc(o._userId).update({ data: updateData });
      await db.collection('pointLogs').add({
        data: {
          _openid: o._openid, type: 'order', delta: Math.floor(o.totalPrice),
          balance: newPoints, remark: `订单 ${o.orderNo} 消费积分`, orderId: o._id,
          createTime: Date.now()
        }
      });
    }
  }

  // 发送订阅消息
  await sendSubMsg(openid, 'orderPay', {
    character_string1: { value: o.orderNo },
    amount2: { value: o.totalPrice + ' 元' },
    phrase3: { value: '支付成功' },
    date4: { value: new Date().toLocaleString('zh-CN') }
  });

  return { errcode: 0, errmsg: 'OK' };
}

async function handlePayFail(event, db, _) {
  const { out_trade_no, err_code_des } = event;
  if (!out_trade_no) return { errcode: 0, errmsg: 'OK' };
  const order = await db.collection('orders').where({ outTradeNo: out_trade_no }).limit(1).get();
  if (!order.data[0]) return { errcode: 0, errmsg: 'OK' };

  const o = order.data[0];
  // 恢复库存
  for (const it of o.items) {
    await db.collection('goods').doc(it._id).update({
      data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
    }).catch(() => {});
  }
  await db.collection('orders').doc(o._id).update({
    data: { status: -1, cancelReason: err_code_des || '支付失败', updateTime: Date.now() }
  });
  await writeLog(db, {
    orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
    action: 'pay_fail', fromStatus: 0, toStatus: -1,
    operator: 'system', operatorType: 'system',
    remark: `支付失败: ${err_code_des || '未知错误'}`
  });
  return { errcode: 0, errmsg: 'OK' };
}

async function handleRefund(event, db, _) {
  const { out_trade_no, out_refund_no, refund_status, refund_fee } = event;
  console.log('[payCallback] 退款回调:', out_refund_no, refund_status);

  if (refund_status === 'SUCCESS') {
    const refund = await db.collection('refunds').where({ outRefundNo: out_refund_no }).limit(1).get();
    if (refund.data[0]) {
      await db.collection('refunds').doc(refund.data[0]._id).update({
        data: { status: 2, refundId: event.refund_id || '', completeTime: Date.now() }
      });
      const order = await db.collection('orders').where({ outTradeNo: out_trade_no }).limit(1).get();
      if (order.data[0]) {
        await db.collection('orders').doc(order.data[0]._id).update({
          data: { status: -2, refundStatus: 2, updateTime: Date.now() }
        });
        await writeLog(db, {
          orderId: order.data[0]._id, orderNo: order.data[0].orderNo,
          _openid: order.data[0]._openid,
          action: 'refund', fromStatus: 1, toStatus: -2,
          operator: 'system', operatorType: 'system',
          remark: `退款成功,金额: ${refund_fee} 分`
        });
      }
    }
  }
  return { errcode: 0, errmsg: 'OK' };
}
