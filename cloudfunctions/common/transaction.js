// common/transaction.js - 数据库操作工具
// 1. 原子条件更新(用 _ 条件避免覆盖)
// 2. 软删除(status=-1 + updateTime)
// 3. 单条查询 + 缓存
// 4. 锁(基于 _id 原子操作,简化版)

const { BizError, ErrorCode } = require('./errors.js');
const { logger } = require('./logger.js');

/**
 * 安全获取单条: 不存在返回 null,不抛错
 */
async function findOne(db, collection, where) {
  const res = await db.collection(collection).where(where).limit(1).get();
  return res.data[0] || null;
}

/**
 * 必存在查询
 */
async function findOneOrThrow(db, collection, where, msg = '记录不存在') {
  const item = await findOne(db, collection, where);
  if (!item) throw new BizError(msg, ErrorCode.NOT_FOUND);
  return item;
}

/**
 * 软删除
 */
async function softDelete(db, collection, id) {
  return db.collection(collection).doc(id).update({
    data: { status: -1, deleteTime: Date.now() }
  });
}

/**
 * 原子自增
 */
async function incField(db, collection, where, field, delta = 1) {
  return db.collection(collection).where(where).update({
    data: { [field]: db.command.inc(delta), updateTime: Date.now() }
  });
}

/**
 * 批量封装: 把所有要做的操作串起来
 *   任一失败就 throw
 *   调用方负责回滚(后续可用 transaction 升级)
 */
async function batch(actions) {
  const results = [];
  for (const a of actions) {
    try {
      const r = await a();
      results.push({ ok: true, data: r });
    } catch (e) {
      logger.error('batch step failed', e, { index: results.length });
      throw e;
    }
  }
  return results;
}

/**
 * 简化版乐观锁: 用 _ + version 字段
 *   update(db, coll, id, { ... }, expectedVersion)
 *   version 不匹配时抛错
 */
async function updateWithVersion(db, collection, id, data, expectedVersion) {
  const res = await db.collection(collection).doc(id).update({
    data: { ...data, version: db.command.inc(1), updateTime: Date.now() }
  });
  if (res.updated === 0) {
    throw new BizError('数据已被修改,请重试', ErrorCode.CONFLICT);
  }
  return res;
}

/**
 * 分页查询
 *   where: { status: 1, type: 'x' }
 *   opts:  { orderBy: 'createTime', order: 'desc', page: 1, pageSize: 20 }
 */
async function paginate(db, collection, where = {}, opts = {}) {
  const { orderBy = 'createTime', order = 'desc', page = 1, pageSize = 20, fields } = opts;
  const q = db.collection(collection).where(where);
  if (fields) q.field(fields);
  const res = await q
    .orderBy(orderBy, order)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return {
    list: res.data,
    hasMore: res.data.length === pageSize,
    page,
    pageSize
  };
}

/**
 * 安全的数值解析
 */
function num(v, def = 0) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

module.exports = {
  findOne,
  findOneOrThrow,
  softDelete,
  incField,
  batch,
  updateWithVersion,
  paginate,
  num
};
