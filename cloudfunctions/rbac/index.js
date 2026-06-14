// rbac - 员工权限管理
// action: list / create / update / delete / grant / check
const { cloud, ok, fail, auth } = require('../common/index.js');

// 角色定义
const ROLES = {
  super_admin: { name: '超管', permissions: ['*'] },
  admin: { name: '店长', permissions: ['order:*', 'goods:*', 'user:read', 'marketing:*', 'finance:read', 'agent:*'] },
  operator: { name: '运营', permissions: ['goods:write', 'order:read', 'marketing:write', 'user:read'] },
  finance: { name: '财务', permissions: ['finance:*', 'order:read'] },
  customer_service: { name: '客服', permissions: ['agent:read', 'agent:write', 'user:read', 'order:read'] },
  readonly: { name: '只读', permissions: ['*:read'] }
};

const PERMISSION_HIERARCHY = {
  'order:*': ['order:read', 'order:write', 'order:delete', 'order:refund'],
  'goods:*': ['goods:read', 'goods:write', 'goods:delete'],
  'marketing:*': ['marketing:read', 'marketing:write'],
  'finance:*': ['finance:read', 'finance:write', 'finance:withdraw'],
  'agent:*': ['agent:read', 'agent:write']
};

function checkPermission(role, perm) {
  const r = ROLES[role];
  if (!r) return false;
  if (r.permissions.includes('*')) return true;
  if (r.permissions.includes(perm)) return true;
  // 通配符:order:* 满足 order:read
  for (const p of r.permissions) {
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -2);
      if (perm.startsWith(prefix + ':') || perm === prefix) return true;
    }
    if (p.endsWith(':read') && perm.endsWith(':read')) {
      const prefix = p.slice(0, -5);
      if (perm.startsWith(prefix + ':')) return true;
    }
  }
  return false;
}

exports.main = auth(async (event) => {
  const { action = 'check' } = event;
  switch (action) {
    case 'list': return listEmployees(event);
    case 'create': return createEmployee(event);
    case 'update': return updateEmployee(event);
    case 'delete': return deleteEmployee(event);
    case 'check': return checkPermAction(event);
    case 'logs': return getAuditLogs(event);
    default: return fail('未知 action');
  }
});

async function checkPermAction(event) {
  const { role, permission } = event;
  return ok({ hasPermission: checkPermission(role, permission) });
}

async function listEmployees(event) {
  const db = cloud.database();
  const list = await db.collection('employees')
    .where({ status: 1 })
    .orderBy('createTime', 'desc')
    .limit(100)
    .get();
  // 不返回密码
  return ok(list.data.map(e => ({ ...e, password: undefined })));
}

async function createEmployee(event) {
  const { name, phone, role, password } = event;
  if (!name || !phone || !role) return fail('姓名/手机/角色 必填');
  if (!ROLES[role]) return fail('未知角色');
  if (!/^1\d{10}$/.test(phone)) return fail('手机号错误');

  const db = cloud.database();
  const exist = await db.collection('employees').where({ phone }).limit(1).get();
  if (exist.data[0]) return fail('手机号已存在');

  const now = Date.now();
  const res = await db.collection('employees').add({
    data: {
      name, phone, role,
      password: hashPassword(password || '123456'),
      status: 1,
      permissions: ROLES[role].permissions,
      createTime: now,
      lastLoginTime: 0
    }
  });
  await writeAuditLog(event, 'create_employee', 'employee', res._id, { name, role });
  return ok({ id: res._id });
}

async function updateEmployee(event) {
  const { id, role, status, name } = event;
  if (!id) return fail('id 必填');

  const db = cloud.database();
  const update = { updateTime: Date.now() };
  if (role) {
    if (!ROLES[role]) return fail('未知角色');
    update.role = role;
    update.permissions = ROLES[role].permissions;
  }
  if (status !== undefined) update.status = status;
  if (name) update.name = name;

  await db.collection('employees').doc(id).update({ data: update });
  await writeAuditLog(event, 'update_employee', 'employee', id, update);
  return ok({ updated: true });
}

async function deleteEmployee(event) {
  const { id } = event;
  if (!id) return fail('id 必填');
  const db = cloud.database();
  await db.collection('employees').doc(id).update({ data: { status: 0, deleteTime: Date.now() } });
  await writeAuditLog(event, 'delete_employee', 'employee', id, {});
  return ok({ deleted: true });
}

async function getAuditLogs(event) {
  const { page = 1, pageSize = 30, action = '', operatorId = '', actionFilter = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const where = {};
  if (action) where.action = action;
  if (operatorId) where.operatorId = operatorId;
  if (actionFilter) {
    // 按目标类型过滤
    where.targetType = db.RegExp({ regexp: actionFilter, options: 'i' });
  }
  const res = await db.collection('auditLogs')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}

async function writeAuditLog(event, action, targetType, targetId, detail) {
  await cloud.database().collection('auditLogs').add({
    data: {
      operatorId: event._userId,
      operatorName: event._userName || '',
      action,
      targetType,
      targetId,
      detail: typeof detail === 'object' ? JSON.stringify(detail) : String(detail || ''),
      ip: '',
      createTime: Date.now()
    }
  }).catch(() => {});
}

function hashPassword(pwd) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(pwd + 'rbac_salt_2024').digest('hex');
}
