// cloudfunctions/adminOrderList/index.js
// 订单列表(后台): 搜索/筛选/分页/导出
//   入参: { keyword, status, payStatus, startTime, endTime, minAmount, maxAmount, page, size }
const { cloud, ok, fail, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const db = cloud.database();
  const _ = db.command;
  const where = {};

  if (event.keyword) {
    where.orderNo = new db.RegExp({ regexp: event.keyword, options: 'i' });
  }
  if (event.status !== undefined && event.status !== '') where.status = Number(event.status);
  if (event.payStatus !== undefined && event.payStatus !== '') where.payStatus = Number(event.payStatus);
  if (event.openid) where._openid = event.openid;

  if (event.startTime || event.endTime) {
    where.createTime = {};
    if (event.startTime) where.createTime = _.gte(Number(event.startTime));
    if (event.endTime) where.createTime = _.lte(Number(event.endTime));
  }
  if (event.minAmount || event.maxAmount) {
    where.total = {};
    if (event.minAmount) where.total = _.gte(Number(event.minAmount));
    if (event.maxAmount) where.total = _.lte(Number(event.maxAmount));
  }

  const page = Number(event.page || 1);
  const size = Math.min(Number(event.size || 20), 100);
  const sortField = event.sort || 'createTime';
  const sortDir = event.dir === 'asc' ? 'asc' : 'desc';

  const res = await db.collection('orders')
    .where(where)
    .orderBy(sortField, sortDir)
    .skip((page - 1) * size)
    .limit(size)
    .get();

  const cntRes = await db.collection('orders').where(where).count().catch(() => ({ total: 0 }));

  // 汇总
  const sumRes = await db.collection('orders').where(where).field({ total: true, payAmount: true }).limit(1000).get()
    .catch(() => ({ data: [] }));
  let sumTotal = 0, sumPaid = 0;
  for (const o of (sumRes.data || [])) {
    sumTotal += Number(o.total || 0);
    sumPaid += Number(o.payAmount || 0);
  }

  return ok({
    list: res.data || [],
    total: cntRes.total || 0,
    page, size,
    summary: { sumTotal, sumPaid }
  });
});
