// cloudfunctions/adminGoodsList/index.js
// 商品列表(后台): 搜索/筛选/分页/导出
//   入参: { keyword, category, status, stockLow, page, size, sort }
const { cloud, ok, fail, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

exports.main = auth(async (event, context) => {
  requireAdmin(event);
  const db = cloud.database();
  const _ = db.command;
  const where = { status: _.neq(-1) };  // 排除软删

  if (event.keyword) {
    // 简易: name 含关键字
    where.name = new db.RegExp({ regexp: event.keyword, options: 'i' });
  }
  if (event.category) where.category = event.category;
  if (event.status !== undefined && event.status !== '') where.status = Number(event.status);
  if (event.stockLow === true) where.stock = _.lte(10);
  if (event.tags && event.tags.length) where.tags = _.in(event.tags);

  const page = Number(event.page || 1);
  const size = Math.min(Number(event.size || 20), 100);
  const sortField = event.sort || 'updateTime';
  const sortDir = event.dir === 'asc' ? 'asc' : 'desc';

  const res = await db.collection('goods')
    .where(where)
    .orderBy(sortField, sortDir)
    .skip((page - 1) * size)
    .limit(size)
    .get();

  const cntRes = await db.collection('goods').where(where).count().catch(() => ({ total: 0 }));
  return ok({
    list: res.data || [],
    total: cntRes.total || 0,
    page, size
  });
});
