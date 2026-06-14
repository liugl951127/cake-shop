// cloudfunctions/manageTenant/index.js
// 多租户管理
//   action = list / get / create / update / disable / enable
// 鉴权: super_admin

const { cloud, ok, fail, logger, authOptional, ErrorCode, BizError } = require('../common/index.js');
const { audit } = require('../common/audit.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const action = event.action;
  if (action === 'list') {
    const list = await db.collection('tenants')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    return ok({ list: list.data });
  }
  if (action === 'get') {
    if (!event.tenantId) return fail('tenantId 必填', ErrorCode.BAD_REQUEST);
    const r = await db.collection('tenants').doc(event.tenantId).get();
    if (!r.data) return fail('租户不存在', ErrorCode.TENANT_NOT_FOUND);
    return ok(r.data);
  }
  if (action === 'create') {
    if (!event.name) return fail('name 必填', ErrorCode.BAD_REQUEST);
    if (!event.code) return fail('code 必填', ErrorCode.BAD_REQUEST);
    const exist = await db.collection('tenants')
      .where({ code: event.code }).limit(1).get();
    if (exist.data && exist.data.length) {
      return fail('租户 code 已存在', ErrorCode.CONFLICT);
    }
    const doc = {
      code: event.code,
      name: event.name,
      status: event.status || 'active',
      plan: event.plan || 'free',
      expireAt: event.expireAt || (Date.now() + 365 * 24 * 60 * 60 * 1000),
      quota: event.quota || {
        users: 10000,
        orders: 100000,
        apiCallsPerDay: 1000000,
        storageGB: 50
      },
      contact: event.contact || {},
      remark: event.remark || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const res = await db.collection('tenants').add({ data: doc });
    await audit(db, {
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: res._id,
      operatorId: event.operatorId || 'system',
      operatorName: event.operatorName || '',
      detail: { name: doc.name, code: doc.code }
    });
    return ok({ ...doc, _id: res._id });
  }
  if (action === 'update') {
    if (!event.tenantId) return fail('tenantId 必填', ErrorCode.BAD_REQUEST);
    const before = await db.collection('tenants').doc(event.tenantId).get();
    if (!before.data) return fail('租户不存在', ErrorCode.TENANT_NOT_FOUND);
    const update = {};
    ['name', 'plan', 'expireAt', 'quota', 'contact', 'remark'].forEach(k => {
      if (event[k] != null) update[k] = event[k];
    });
    if (event.status) update.status = event.status;
    update.updatedAt = Date.now();
    await db.collection('tenants').doc(event.tenantId).update({ data: update });
    const after = await db.collection('tenants').doc(event.tenantId).get();
    await audit(db, {
      action: 'tenant.update',
      targetType: 'tenant',
      targetId: event.tenantId,
      operatorId: event.operatorId || 'system',
      before: before.data,
      after: after.data
    });
    return ok(after.data);
  }
  if (action === 'disable' || action === 'enable') {
    const status = action === 'disable' ? 'disabled' : 'active';
    if (!event.tenantId) return fail('tenantId 必填', ErrorCode.BAD_REQUEST);
    const before = await db.collection('tenants').doc(event.tenantId).get();
    if (!before.data) return fail('租户不存在', ErrorCode.TENANT_NOT_FOUND);
    await db.collection('tenants').doc(event.tenantId).update({
      data: { status, updatedAt: Date.now() }
    });
    const after = await db.collection('tenants').doc(event.tenantId).get();
    await audit(db, {
      action: 'tenant.' + action,
      targetType: 'tenant',
      targetId: event.tenantId,
      operatorId: event.operatorId || 'system',
      before: before.data,
      after: after.data
    });
    return ok(after.data);
  }
  return fail('未知 action', ErrorCode.BAD_REQUEST);
});
