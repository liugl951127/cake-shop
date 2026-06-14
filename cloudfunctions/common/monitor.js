// common/monitor.js
// 性能监控 + 异常上报
//   - report(metric): 性能指标(响应时长/计数/错误率)
//   - reportError(ex): 异常上报(去重)
//   - dashboard(tenantId, timeRange): 大盘聚合

const { logger } = require('./logger.js');
const { num } = require('./transaction.js');
const { extractTenantId } = require('./tenant.js');

const METRIC_COLL = 'performance_metrics';
const ERROR_COLL = 'error_reports';
const REPORT_BATCH = 100;

/**
 * 性能监控打点
 *   metric: {
 *     name,        // 'cf.latency' / 'api.qps' / 'db.query'
 *     value,       // 数值(毫秒/次/字节)
 *     tags,        // { route, code, ... }
 *     tenantId
 *   }
 */
async function report(db, metric) {
  if (!metric || !metric.name) return null;
  if (typeof metric.value !== 'number' || isNaN(metric.value)) return null;
  const doc = {
    name: metric.name,
    value: metric.value,
    tags: metric.tags || {},
    tenantId: metric.tenantId || 'default',
    ts: Date.now()
  };
  try {
    const res = await db.collection(METRIC_COLL).add({ data: doc });
    return { ...doc, _id: res._id };
  } catch (e) {
    logger.error('metric report fail', { name: doc.name, e: e.message });
    return null;
  }
}

/**
 * 批量上报
 */
async function reportBatch(db, metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return { inserted: 0 };
  const now = Date.now();
  const docs = metrics
    .filter(m => m && m.name && typeof m.value === 'number' && !isNaN(m.value))
    .map(m => ({
      name: m.name,
      value: m.value,
      tags: m.tags || {},
      tenantId: m.tenantId || 'default',
      ts: m.ts || now
    }));
  let total = 0;
  for (let i = 0; i < docs.length; i += REPORT_BATCH) {
    const slice = docs.slice(i, i + REPORT_BATCH);
    await db.collection(METRIC_COLL).add({ data: slice });
    total += slice.length;
  }
  return { inserted: total };
}

/**
 * 异常上报(去重)
 *   errReport: {
 *     message, stack, type, scene, level,
 *     context(任意 JSON: userId/route/payload...),
 *     tenantId
 *   }
 *  - 5 分钟内同 message+stack+tenant 只记一次
 */
async function reportError(db, errReport) {
  if (!errReport || !errReport.message) return null;
  const fingerprint = fingerprintError(errReport);
  // 用 audit_logs 的同一思路,这里简单用一个临时 hash
  const dedupKey = `err:${errReport.tenantId || 'default'}:${fingerprint}`;
  // 用 cache 简单去重
  const { cache } = require('./cache.js');
  if (cache.get(dedupKey)) {
    return { deduped: true };
  }
  cache.set(dedupKey, 1, 300);  // 5 分钟

  const doc = {
    fingerprint,
    message: errReport.message,
    stack: (errReport.stack || '').slice(0, 4000),
    type: errReport.type || 'Error',
    scene: errReport.scene || 'cloudfunction',
    level: errReport.level || 'error',
    context: errReport.context || null,
    tenantId: errReport.tenantId || 'default',
    userId: errReport.userId || '',
    deviceId: errReport.deviceId || '',
    count: 1,
    ts: Date.now()
  };
  try {
    const res = await db.collection(ERROR_COLL).add({ data: doc });
    return { ...doc, _id: res._id, deduped: false };
  } catch (e) {
    logger.error('error report fail', { msg: doc.message, e: e.message });
    return null;
  }
}

function fingerprintError(r) {
  // 用 message + 第一行 stack 做指纹
  const m = (r.message || '').slice(0, 200);
  const stackLine = (r.stack || '').split('\n')[1] || '';
  return require('crypto')  // Node 环境
    ? Buffer.from(m + '|' + stackLine).toString('base64').slice(0, 32)
    : (m + '|' + stackLine).slice(0, 32);
}

/**
 * 性能监控埋点包装
 *   wrap('addOrder', fn)
 *   -> 自动收集 latency / result / error
 */
function wrap(db, name, fn, opts = {}) {
  return async (event, context) => {
    const start = Date.now();
    const tenantId = extractTenantId(event);
    let success = true, errorMsg = '';
    try {
      const r = await fn(event, context);
      return r;
    } catch (e) {
      success = false;
      errorMsg = e.message;
      if (opts.reportError !== false) {
        await reportError(db, {
          message: `${name}: ${e.message}`,
          stack: e.stack,
          type: e.name || 'Error',
          scene: 'cloudfunction.' + name,
          tenantId,
          context: { route: name, userId: event.userId || event.openid || '' }
        });
      }
      throw e;
    } finally {
      const latency = Date.now() - start;
      await report(db, {
        name: 'cf.latency',
        value: latency,
        tags: { route: name, success: String(success), code: success ? '0' : '5000' },
        tenantId
      });
    }
  };
}

/**
 * 大盘聚合
 *   { tenantId, name, startTs, endTs, bucket = 'hour' }
 */
async function aggregate(db, params) {
  const _ = db.command;
  const w = {};
  if (params.name) w.name = params.name;
  if (params.tenantId) w.tenantId = params.tenantId;
  if (params.startTs || params.endTs) {
    w.ts = {};
    if (params.startTs) w.ts['$gte'] = params.startTs;
    if (params.endTs) w.ts['$lte'] = params.endTs;
  }

  const coll = db.collection(METRIC_COLL);
  const all = await coll.where(w).limit(5000).get().then(r => r.data);

  // 内存聚合
  const stats = {};   // { 'route:addOrder' : { count, sum, max, min, p50, p95 } }
  for (const m of all) {
    const route = m.tags && m.tags.route;
    const key = route ? m.name + ':' + route : m.name;
    if (!stats[key]) stats[key] = { count: 0, sum: 0, max: 0, min: Infinity, values: [] };
    const s = stats[key];
    s.count += 1;
    s.sum += m.value;
    s.max = Math.max(s.max, m.value);
    s.min = Math.min(s.min, m.value);
    s.values.push(m.value);
  }
  // 计算 p50/p95
  for (const k of Object.keys(stats)) {
    const s = stats[k];
    s.avg = s.sum / s.count;
    s.values.sort((a, b) => a - b);
    s.p50 = s.values[Math.floor(s.values.length * 0.5)];
    s.p95 = s.values[Math.floor(s.values.length * 0.95)];
    delete s.values;
    s.sum = Number(s.sum.toFixed(2));
    s.avg = Number(s.avg.toFixed(2));
  }
  return { total: all.length, stats };
}

/**
 * 异常聚合
 *   { tenantId, startTs, endTs }
 */
async function aggregateErrors(db, params) {
  const w = {};
  if (params.tenantId) w.tenantId = params.tenantId;
  if (params.startTs || params.endTs) {
    w.ts = {};
    if (params.startTs) w.ts['$gte'] = params.startTs;
    if (params.endTs) w.ts['$lte'] = params.endTs;
  }
  const coll = db.collection(ERROR_COLL);
  const list = await coll.where(w).orderBy('ts', 'desc').limit(200).get().then(r => r.data);
  return list;
}

module.exports = {
  report,
  reportBatch,
  reportError,
  wrap,
  aggregate,
  aggregateErrors,
  METRIC_COLL,
  ERROR_COLL
};
