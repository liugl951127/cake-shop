// refund - 申请退款
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { genOutTradeNo, refund: doRefund } = require('../common/pay.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = auth(async (event) => {
  const { orderId, reason = '用户申请退款' } = event;
  if (!orderId) throw new BizError('orderId 必填');
  if (!reason || reason.length > 200) throw new BizError('原因 1-200 字');

  const db = cloud.database();
  const _ = db.command;
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) throw new BizError('订单不存在');
  const o = order.data;
  if (o._openid !== event._openid && !event._isAdmin) throw new BizError('无权操作此订单');
  if (o.status < 1) throw new BizError('订单未支付,无需退款');
  if (o.status >= -1 && o.status !== 1) throw new BizError('订单已取消或已退款');
  if (o.refundStatus === 1) throw new BizError('退款处理中,请勿重复申请');

  const outRefundNo = genOutTradeNo('RF');

  // 写退款记录
  await db.collection('refunds').add({
    data: {
      _openid: o._openid,
      orderId: o._id,
      orderNo: o.orderNo,
      outTradeNo: o.outTradeNo,
      outRefundNo,
      totalFee: o.totalFee,
      refundFee: o.totalFee,
      reason,
      status: 1, // 1-处理中 2-成功 3-失败
      createTime: Date.now()
    }
  });

  // 更新订单状态
  await db.collection('orders').doc(o._id).update({
    data: {
      status: 5, // 退款中
      refundStatus: 1,
      refundReason: reason,
      updateTime: Date.now()
    }
  });

  await writeLog(db, {
    orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
    action: 'refund_request', fromStatus: 1, toStatus: 5,
    operator: event._openid, operatorType: 'user',
    remark: `申请退款: ${reason}`
  });

  // 真实环境: 调用微信退款 API
  // 演示模式: 同步标记为退款成功
  const isDemo = !process.env.MCH_ID || process.env.MCH_ID === 'YOUR_MCH_ID';
  if (isDemo) {
    setTimeout(async () => {
      try {
        const dbase = cloud.database();
        await dbase.collection('refunds').where({ outRefundNo }).update({
          data: { status: 2, completeTime: Date.now() }
        });
        await dbase.collection('orders').doc(o._id).update({
          data: { status: -2, refundStatus: 2, updateTime: Date.now() }
        });
        // 恢复库存
        for (const it of o.items) {
          await dbase.collection('goods').doc(it._id).update({
            data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
          }).catch(() => {});
        }
        await writeLog(dbase, {
          orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
          action: 'refund', fromStatus: 5, toStatus: -2,
          operator: 'system', operatorType: 'system',
          remark: '演示模式自动退款成功'
        });
      } catch (e) {
        console.error('演示退款失败:', e);
      }
    }, 1000);
  } else {
    // 真实退款
    const r = await doRefund({
      outTradeNo: o.outTradeNo,
      outRefundNo,
      totalFee: o.totalFee,
      refundFee: o.totalFee,
      reason
    });
    if (!r.success) throw new BizError('退款申请失败: ' + r.error);
  }

  return ok({ outRefundNo });
});
