// common/audit.js (升级版)
// 操作审计 + 操作回放
//   - 写操作自动落 audit_logs
//   - 关键操作存 snapshot(操作前的对象状态)
//   - 支持按 tenant/action/operator/time 检索
//   - 用于事后回放 / 责任界定 / 数据回滚

const { logger } = require('./logger.js');
const { num } = require('./transaction.js');
const { extractTenantId } = require('./tenant.js');

const COLLECTION = 'audit_logs';

// 审计严重级别
const Severity = {
  INFO: 'info',
  WARN: 'warn',
  CRITICAL: 'critical'
};

/**
 * 写一条审计日志(单条)
 *   auditInfo: {
 *     action,              // 必填,如 'order.cancel' / 'employee.changeRole'
 *     targetType,          // order / goods / employee / finance
 *     targetId,
 *     operatorId,          // 操作人
 *     operatorName,
 *     operatorRole,
 *     tenantId,
 *     detail,              // 任意 JSON
 *     before,              // 变更前快照(用于回放)
 *     after,               // 变更后快照
 *     ip, userAgent,
 *     severity,            // info/warn/critical
 *     result,              // success / fail
 *     errorMsg
 *   }
 */
async function audit(db, auditInfo) {
  if (!auditInfo || !auditInfo.action) {
    logger.warn('audit missing action', auditInfo);
    return null;
  }
  const doc = {
    action: auditInfo.action,
    targetType: auditInfo.targetType || '',
    targetId: String(auditInfo.targetId || ''),
    operatorId: auditInfo.operatorId || '',
    operatorName: auditInfo.operatorName || '',
    operatorRole: auditInfo.operatorRole || '',
    tenantId: auditInfo.tenantId || 'default',
    detail: auditInfo.detail || null,
    before: auditInfo.before || null,
    after: auditInfo.after || null,
    ip: auditInfo.ip || '',
    userAgent: auditInfo.userAgent || '',
    severity: auditInfo.severity || Severity.INFO,
    result: auditInfo.result || 'success',
    errorMsg: auditInfo.errorMsg || '',
    ts: Date.now(),
    replayable: !!(auditInfo.before || auditInfo.after)
  };
  try {
    const res = await db.collection(COLLECTION).add({ data: doc });
    return { ...doc, _id: res._id };
  } catch (e) {
    // 审计失败: logger 但不抛异常(避免影响主业务)
    logger.error('audit log fail', { action: doc.action, e: e.message });
    return null;
  }
}

/**
 * 自动包装一个 async fn,在执行前后自动审计
 *   wrapAction(fn, { action, targetType, getTargetId, getBefore, getDetail })
 */
function wrapAction(db, fn, opts) {
  return async (event, context) => {
    const operatorId = event.operatorId || event.userId || event.openid || '';
    const tenantId = extractTenantId(event);
    let before = null;
    if (opts.getBefore) {
      try { before = await opts.getBefore(event); } catch (e) { /* ignore */ }
    }
    let result, errorMsg, success;
    try {
      result = await fn(event, context);
      success = true;
    } catch (e) {
      errorMsg = e.message;
      success = false;
      throw e;
    } finally {
      try {
        await audit(db, {
          action: opts.action,
          targetType: opts.targetType,
          targetId: opts.getTargetId ? opts.getTargetId(event) : (event.id || ''),
          operatorId, operatorName: event.operatorName || '',
          operatorRole: event.operatorRole || '',
          tenantId,
          detail: opts.getDetail ? opts.getDetail(event, result) : null,
          before,
          after: success ? (opts.getAfter ? await opts.getAfter(event, result) : result) : null,
          ip: event.ip || '',
          userAgent: event.userAgent || '',
          severity: opts.severity || Severity.INFO,
          result: success ? 'success' : 'fail',
          errorMsg
        });
      } catch (e) {
        logger.warn('wrapAction audit fail', { e: e.message });
      }
    }
    return result;
  };
}

/**
 * 审计日志查询
 *   { tenantId, action, operatorId, targetType, targetId,
 *     startTs, endTs, severity, page, size }
 */
async function queryAuditLogs(db, params = {}) {
  const w = {};
  if (params.tenantId) w.tenantId = params.tenantId;
  if (params.action) w.action = params.action;
  if (params.operatorId) w.operatorId = params.operatorId;
  if (params.targetType) w.targetType = params.targetType;
  if (params.targetId) w.targetId = String(params.targetId);
  if (params.severity) w.severity = params.severity;
  if (params.startTs || params.endTs) {
    w.ts = {};
    if (params.startTs) w.ts['$gte'] = params.startTs;
    if (params.endTs) w.ts['$lte'] = params.endTs;
  }

  const page = num(params.page, 1);
  const size = Math.min(num(params.size, 50), 200);
  const skip = (page - 1) * size;

  const coll = db.collection(COLLECTION);
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll
    .where(w)
    .orderBy('ts', 'desc')
    .skip(skip)
    .limit(size)
    .get()
    .then(r => r.data);
  return { total, list, page, size };
}

/**
 * 操作回放 - 给定一个 auditId,返回 before/after 状态机
 *   { auditId } -> { audit, before, after, changes: [...] }
 */
async function replay(db, auditId) {
  const res = await db.collection(COLLECTION).doc(auditId).get();
  if (!res.data) return null;
  const a = res.data;
  const changes = diffObjects(a.before || {}, a.after || {});
  return { audit: a, before: a.before, after: a.after, changes };
}

/**
 * 简单对象 diff
 */
function diffObjects(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const k of keys) {
    const b = JSON.stringify(before[k]);
    const a = JSON.stringify(after[k]);
    if (b !== a) {
      changes.push({ key: k, before: before[k], after: after[k] });
    }
  }
  return changes;
}

module.exports = {
  Severity,
  audit,
  wrapAction,
  queryAuditLogs,
  replay,
  diffObjects,
  COLLECTION
};
