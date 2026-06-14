// cancelOrder - 取消订单(带状态机校验)
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

const ALLOW_CANCEL_STATUS = [0]; // 只有待付款可以取消

exports.main = auth(async (event) => {
  const { id, remove, reason = '用户主动取消' } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const _ = db.command;

  const order = await db.collection('orders').doc(id).get();
  if (!order.data) throw new BizError('订单不存在');
  const o = order.data;

  if (o._openid !== event._openid && !event._isAdmin) {
    throw new BizError('无权操作');
  }

  // 删除已完成订单(隐藏)
  if (remove) {
    if (o._openid !== event._openid && !event._isAdmin) throw new BizError('无权操作');
    await db.collection('orders').doc(id).remove();
    return ok();
  }

  // 状态机校验
  if (!ALLOW_CANCEL_STATUS.includes(o.status)) {
    throw new BizError(`订单当前状态(${o.status})不可取消`);
  }

  // 恢复库存
  for (const it of o.items) {
    await db.collection('goods').doc(it._id).update({
      data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
    }).catch(() => {});
  }

  await db.collection('orders').doc(id).update({
    data: { status: -1, cancelReason: reason, updateTime: Date.now() }
  });

  await writeLog(db, {
    orderId: id, orderNo: o.orderNo, _openid: o._openid,
    action: 'cancel', fromStatus: 0, toStatus: -1,
    operator: event._openid, operatorType: 'user',
    remark: reason
  });

  return ok();
});
