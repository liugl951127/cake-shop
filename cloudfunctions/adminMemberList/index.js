// cloudfunctions/adminMemberList/index.js
// 会员列表(后台): 搜索/筛选/分页
//   入参: { keyword, level, startTime, endTime, page, size }
const { cloud, ok, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const db = cloud.database();
  const _ = db.command;
  const where = {};

  if (event.keyword) {
    // 模糊查询 phone / nickName
    const r = new db.RegExp({ regexp: event.keyword, options: 'i' });
    where.$or = [{ phone: r }, { nickName: r }];
  }
  if (event.level !== undefined && event.level !== '') where.level = Number(event.level);
  if (event.startTime || event.endTime) {
    where.createTime = {};
    if (event.startTime) where.createTime = _.gte(Number(event.startTime));
    if (event.endTime) where.createTime = _.lte(Number(event.endTime));
  }
  if (event.minPoints) where.points = _.gte(Number(event.minPoints));

  const page = Number(event.page || 1);
  const size = Math.min(Number(event.size || 20), 100);

  const res = await db.collection('members')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();
  const cntRes = await db.collection('members').where(where).count().catch(() => ({ total: 0 }));

  return ok({
    list: res.data || [],
    total: cntRes.total || 0,
    page, size
  });
});
