// confirmReceive - 确认收货
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = auth(async (event) => {
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const order = await db.collection('orders').doc(id).get();
  if (!order.data) throw new BizError('订单不存在');
  const o = order.data;
  if (o._openid !== event._openid) throw new BizError('无权操作');
  if (o.status !== 3) throw new BizError('订单不在配送中,无法确认');

  await db.collection('orders').doc(id).update({
    data: { status: 4, completeTime: Date.now(), updateTime: Date.now() }
  });
  await writeLog(db, {
    orderId: id, orderNo: o.orderNo, _openid: o._openid,
    action: 'confirm_receive', fromStatus: 3, toStatus: 4,
    operator: event._openid, operatorType: 'user',
    remark: '用户确认收货'
  });
  return ok();
});
