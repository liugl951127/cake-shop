// cloudfunctions/adminGoodsBatch/index.js
// 商品批量操作: 上下架/调价/调库存/改分类/推荐位
//   必传 admin 操作(写 audit_logs)
const { cloud, ok, fail, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

exports.main = auth(async (event, context) => {
  requireAdmin(event);
  const db = cloud.database();
  const { action, ids, payload } = event;
  if (!action) throw new BizError('action 必填', ErrorCode.BAD_REQUEST);
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BizError('ids 必填(数组)', ErrorCode.BAD_REQUEST);
  }
  if (ids.length > 500) {
    throw new BizError('单次最多 500 个', ErrorCode.LIMIT_EXCEEDED);
  }

  const now = Date.now();
  const upd = { updateTime: now };

  switch (action) {
    case 'onSale':         // 上架
      upd.status = 1; upd.onSaleAt = now; break;
    case 'offSale':        // 下架
      upd.status = 0; upd.offSaleAt = now; break;
    case 'delete':         // 软删除
      upd.status = -1; upd.deletedAt = now; break;
    case 'setStock':       // 设置库存
      if (!payload || payload.stock == null) throw new BizError('payload.stock 必填', ErrorCode.BAD_REQUEST);
      upd.stock = Number(payload.stock); break;
    case 'incStock':       // 增加库存(可正可负)
      // 走原子 update 不能自增,所以这里走单条 loop
      if (!payload || payload.delta == null) throw new BizError('payload.delta 必填', ErrorCode.BAD_REQUEST);
      await _batchInc(db, 'goods', ids, { stock: Number(payload.delta) });
      await _audit(db, event, action, ids, payload);
      logger.info('admin goods batch', { action, count: ids.length, admin: event.adminId });
      return ok({ affected: ids.length, action });
    case 'setCategory':    // 改分类
      if (!payload || !payload.category) throw new BizError('payload.category 必填', ErrorCode.BAD_REQUEST);
      upd.category = payload.category; break;
    case 'setPrice':       // 改价(支持原价 + 售价)
      if (!payload || payload.price == null) throw new BizError('payload.price 必填', ErrorCode.BAD_REQUEST);
      upd.price = Number(payload.price);
      if (payload.originPrice != null) upd.originPrice = Number(payload.originPrice);
      break;
    case 'setRecommend':   // 推荐位
      upd.recommend = !!payload.recommend; break;
    case 'setTag':         // 加 tag
      if (!payload || !payload.tag) throw new BizError('payload.tag 必填', ErrorCode.BAD_REQUEST);
      // 走 _addToSet
      await _addTagToAll(db, ids, payload.tag);
      await _audit(db, event, action, ids, payload);
      logger.info('admin goods batch', { action, count: ids.length, admin: event.adminId });
      return ok({ affected: ids.length, action });
    default:
      throw new BizError('不支持的 action: ' + action, ErrorCode.BAD_REQUEST);
  }

  // 走批量 update
  const _ = db.command;
  for (const id of ids) {
    try {
      await db.collection('goods').doc(id).update({ data: upd });
    } catch (e) {
      logger.warn('goods batch update fail', { id, err: e.message });
    }
  }
  await _audit(db, event, action, ids, payload);
  logger.info('admin goods batch', { action, count: ids.length, admin: event.adminId });
  return ok({ affected: ids.length, action });
});

async function _batchInc(db, coll, ids, fields) {
  const _ = db.command;
  for (const id of ids) {
    try {
      const incObj = {};
      for (const [k, v] of Object.entries(fields)) incObj[k] = _.inc(v);
      await db.collection(coll).doc(id).update({ data: incObj });
    } catch (e) {}
  }
}

async function _addTagToAll(db, ids, tag) {
  const _ = db.command;
  for (const id of ids) {
    try {
      await db.collection('goods').doc(id).update({
        data: { tags: _.addToSet([tag]), updateTime: Date.now() }
      });
    } catch (e) {}
  }
}

async function _audit(db, event, action, ids, payload) {
  try {
    await db.collection('audit_logs').add({
      data: {
        action: 'goods.' + action,
        resourceType: 'goods',
        resourceIds: ids,
        payload: payload || {},
        adminId: event.adminId || '',
        adminName: event.adminName || '',
        tenantId: event.tenantId || 'default',
        ts: Date.now()
      }
    });
  } catch (e) {}
}
