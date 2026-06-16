// cloudfunctions/adminMarketing/index.js
// 营销活动管理: 券/秒杀/拼团/满减
//   action: 'list' | 'create' | 'update' | 'delete' | 'toggle' | 'stats'
//   type: 'coupon' | 'seckill' | 'group' | 'fullReduce' | 'luckyBag'
const { cloud, ok, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

const COLLECTION = {
  coupon: 'coupons',
  seckill: 'seckill',
  group: 'groups',
  fullReduce: 'full_reduces',
  luckyBag: 'lucky_bags'
};

const VALID_ACTIONS = ['list', 'create', 'update', 'delete', 'toggle', 'stats'];
const VALID_TYPES = Object.keys(COLLECTION);

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { action, type } = event;
  if (!VALID_ACTIONS.includes(action)) throw new BizError('action 必填', ErrorCode.BAD_REQUEST);
  if (!VALID_TYPES.includes(type)) throw new BizError('type 必填', ErrorCode.BAD_REQUEST);
  const coll = COLLECTION[type];
  const db = cloud.database();
  const now = Date.now();

  if (action === 'list') {
    const page = Number(event.page || 1);
    const size = Math.min(Number(event.size || 20), 100);
    const where = {};
    if (event.status !== undefined && event.status !== '') where.status = Number(event.status);
    if (event.keyword) where.name = new db.RegExp({ regexp: event.keyword, options: 'i' });

    const res = await db.collection(coll).where(where)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * size)
      .limit(size)
      .get();
    const cnt = await db.collection(coll).where(where).count().catch(() => ({ total: 0 }));
    return ok({ list: res.data || [], total: cnt.total, page, size });
  }

  if (action === 'create' || action === 'update') {
    const data = Object.assign({ updateTime: now }, event.data || {});
    if (action === 'create') {
      data.createTime = now;
      data.createBy = event.adminId || event._openid;
      const r = await db.collection(coll).add({ data });
      await _audit(db, event, type + '.create', r.id || '', data);
      return ok({ id: r.id });
    } else {
      const id = event.id;
      if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);
      await db.collection(coll).doc(id).update({ data });
      await _audit(db, event, type + '.update', id, data);
      return ok({ id });
    }
  }

  if (action === 'delete') {
    const id = event.id;
    if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);
    await db.collection(coll).doc(id).remove();
    await _audit(db, event, type + '.delete', id, {});
    return ok({ deleted: id });
  }

  if (action === 'toggle') {
    const id = event.id;
    if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);
    const doc = await db.collection(coll).doc(id).get();
    if (!doc.data) throw new BizError('记录不存在', ErrorCode.NOT_FOUND);
    const newStatus = (doc.data.status || 0) === 1 ? 0 : 1;
    await db.collection(coll).doc(id).update({
      data: { status: newStatus, updateTime: now }
    });
    await _audit(db, event, type + '.toggle', id, { from: doc.data.status, to: newStatus });
    return ok({ id, status: newStatus });
  }

  if (action === 'stats') {
    // 简单统计
    const total = await db.collection(coll).count().catch(() => ({ total: 0 }));
    const on = await db.collection(coll).where({ status: 1 }).count().catch(() => ({ total: 0 }));
    return ok({
      type, total: total.total, on: on.total, off: total.total - on.total
    });
  }
});

async function _audit(db, event, action, resourceId, payload) {
  try {
    await db.collection('audit_logs').add({
      data: {
        action, resourceType: 'marketing', resourceId,
        payload, adminId: event.adminId || '',
        adminName: event.adminName || '',
        tenantId: event.tenantId || 'default', ts: Date.now()
      }
    });
  } catch (e) {}
}
