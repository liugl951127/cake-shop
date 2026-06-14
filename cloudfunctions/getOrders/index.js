// getOrders - 获取订单列表(完整状态机版)
const { cloud, ok, auth } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  const { status, all } = event;
  const db = cloud.database();
  const where = all ? {} : { _openid: event._openid };
  if (status !== undefined && status !== '') where.status = Number(status);

  const res = await db.collection('orders')
    .where(where)
    .orderBy('createTime', 'desc')
    .limit(100)
    .get();

  const list = res.data.map(o => ({
    ...o,
    createTime: formatTime(new Date(o.createTime), 'MM-DD HH:mm'),
    createTimeFull: formatTime(new Date(o.createTime)),
    expireTime: o.expireTime || 0,
    totalCount: (o.items || []).reduce((s, i) => s + i.count, 0)
  }));
  return ok(list);
});
