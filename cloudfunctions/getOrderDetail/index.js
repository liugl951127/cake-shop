// getOrderDetail - 订单详情 + 状态流转日志
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const order = await db.collection('orders').doc(id).get();
  if (!order.data) return fail('订单不存在', -404);
  const o = order.data;

  // 权限: 自己的订单或管理员
  if (o._openid !== event._openid && !event._isAdmin) {
    return fail('无权查看', -403);
  }

  // 拉日志
  const logs = await db.collection('orderLogs')
    .where({ orderId: id })
    .orderBy('createTime', 'asc')
    .limit(50)
    .get();

  return ok({
    ...o,
    createTime: formatTime(new Date(o.createTime)),
    payTime: o.payTime ? formatTime(new Date(o.payTime)) : '',
    shipTime: o.shipTime ? formatTime(new Date(o.shipTime)) : '',
    completeTime: o.completeTime ? formatTime(new Date(o.completeTime)) : '',
    expireTime: o.expireTime || 0,
    logs: logs.data.map(l => ({
      ...l,
      createTime: formatTime(new Date(l.createTime), 'MM-DD HH:mm:ss')
    }))
  });
});
