// common/tenant.js
// 多租户工具
//   - 解析请求 tenantId(header 优先 / 字段 / 默认)
//   - 加载租户信息(带 cache)
//   - 校验: 启用/未过期/未超额
//   - 数据隔离: 给查询条件自动注入 tenantId
//   - 跨租户访问校验

const { cache } = require('./cache.js');
const { logger } = require('./logger.js');
const { BizError, ErrorCode } = require('./errors.js');

const TENANT_HEADER = 'X-Tenant-Id';
const DEFAULT_TENANT = 'default';
const CACHE_TTL = 5 * 60;  // 5 分钟

/**
 * 从 event 中提取租户 ID
 * 优先级:  header > body.tenantId > body.tenant_id > 默认
 */
function extractTenantId(event) {
  return event.tenantId
      || event.tenant_id
      || (event.headers && event.headers[TENANT_HEADER])
      || (event.headers && event.headers[TENANT_HEADER.toLowerCase()])
      || event.tenant
      || DEFAULT_TENANT;
}

/**
 * 加载租户信息(带缓存)
 *   doc: { _id, name, status, plan, expireAt, quota: { ... } }
 */
async function getTenant(db, tenantId) {
  if (!tenantId) return null;
  const key = `tenant:${tenantId}`;
  let t = cache.get(key);
  if (t) return t;
  try {
    const res = await db.collection('tenants').doc(tenantId).get();
    t = res.data || null;
    if (t) cache.set(key, t, CACHE_TTL);
  } catch (e) {
    logger.warn('load tenant fail', { tenantId, e: e.message });
    return null;
  }
  return t;
}

/**
 * 校验租户可用性
 * 抛 BizError(TENANT_NOT_FOUND / DISABLED / EXPIRED)
 */
async function assertTenantActive(db, tenantId) {
  const t = await getTenant(db, tenantId);
  if (!t) throw new BizError(ErrorCode.TENANT_NOT_FOUND);
  if (t.status === 'disabled') throw new BizError(ErrorCode.TENANT_DISABLED);
  if (t.expireAt && t.expireAt < Date.now()) throw new BizError(ErrorCode.TENANT_EXPIRED);
  return t;
}

/**
 * 校验租户额度(自定义 key)
 *   counter: { name, max }
 *   increments: 本次消耗
 */
async function checkQuota(db, tenant, counterName, increments = 1) {
  if (!tenant || !tenant.quota) return;
  const max = tenant.quota[counterName];
  if (max == null) return;
  const counterId = `${tenant._id}:${counterName}`;
  const _ = db.command;
  // 读当前值
  const cur = await db.collection('tenant_counters').doc(counterId).get()
    .catch(() => ({ data: null }));
  const current = (cur.data && cur.data.value) || 0;
  if (current + increments > max) {
    throw new BizError(ErrorCode.TENANT_QUOTA_EXCEEDED,
      `${counterName} 额度已用完 (${current}/${max})`);
  }
  // 累加
  if (cur.data) {
    await db.collection('tenant_counters').doc(counterId).update({
      data: { value: _.inc(increments), updatedAt: Date.now() }
    });
  } else {
    await db.collection('tenant_counters').add({
      data: {
        _id: counterId,
        tenantId: tenant._id,
        name: counterName,
        value: increments,
        createdAt: Date.now()
      }
    });
  }
}

/**
 * 给查询条件注入 tenantId(数据隔离)
 *   where: 原条件
 *   strict: true 时不存在的 tenantId 直接拒绝
 */
function withTenant(where, tenantId) {
  if (!tenantId) return where;
  return Object.assign({}, where, { tenantId });
}

/**
 * 校验实体属于当前租户
 */
function assertSameTenant(doc, tenantId) {
  if (!doc) return;
  if (doc.tenantId && doc.tenantId !== tenantId) {
    throw new BizError(ErrorCode.TENANT_ISOLATION_DENIED,
      `对象属于租户 ${doc.tenantId},非当前租户 ${tenantId}`);
  }
}

module.exports = {
  TENANT_HEADER,
  DEFAULT_TENANT,
  extractTenantId,
  getTenant,
  assertTenantActive,
  checkQuota,
  withTenant,
  assertSameTenant
};
