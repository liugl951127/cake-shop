const { cloud, ok, auth, requireAdmin } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { status } = event;
  const db = cloud.database();
  const where = {};
  if (status !== undefined && status !== '') where.status = Number(status);

  const res = await db.collection('orders')
    .where(where)
    .orderBy('createTime', 'desc')
    .limit(200)
    .get();
  return ok(res.data.map(o => ({ ...o, createTime: formatTime(new Date(o.createTime)) })));
});
