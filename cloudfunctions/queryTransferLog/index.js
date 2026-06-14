// cloudfunctions/queryTransferLog/index.js
// 转接记录查询

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const w = {};
  if (event.sessionId) w.sessionId = event.sessionId;
  if (event.userId) w.userId = event.userId;
  if (event.toTarget) w.toTarget = event.toTarget;
  if (event.startTs || event.endTs) {
    w.ts = {};
    if (event.startTs) w.ts['$gte'] = event.startTs;
    if (event.endTs) w.ts['$lte'] = event.endTs;
  }
  const page = Number(event.page) || 1;
  const size = Math.min(Number(event.size) || 50, 200);
  const coll = db.collection('transfer_logs');
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll.where(w)
    .orderBy('ts', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get()
    .then(r => r.data);
  return ok({ total, list, page, size });
});
