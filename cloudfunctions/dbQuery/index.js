// dbQuery - 通用查询(给前端用)
// 只允许查"自己的"数据
const { cloud, ok, fail, auth } = require('../common/index.js');

// 允许的集合
const ALLOWED = {
  customOrders: { ownerField: '_userId' },
  bulkOrders: { ownerField: '_userId' },
  birthdayReminders: { ownerField: '_userId' }
};

exports.main = auth(async (event) => {
  const { collection, where = {}, orderBy = 'createTime', order = 'desc', page = 1, pageSize = 20 } = event;
  if (!ALLOWED[collection]) return fail('集合不允许查询');
  if (pageSize > 100) return fail('pageSize 太大');

  const db = cloud.database();
  const _ = db.command;
  const finalWhere = { ...where };
  // 强制只查自己
  finalWhere[ALLOWED[collection].ownerField] = event._userId;

  const res = await db.collection(collection)
    .where(finalWhere)
    .orderBy(orderBy, order)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return ok({ list: res.data, hasMore: res.data.length === pageSize });
});
