// cloudfunctions/reportMetric/index.js
// 性能指标上报(客户端 + 服务端通用)
//   { metrics: [{ name, value, tags }] }

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { reportBatch } = require('../common/monitor.js');
const { extractTenantId } = require('../common/tenant.js');

const MAX_BATCH = 200;

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const metrics = event.metrics;
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return fail('metrics 必填', ErrorCode.BAD_REQUEST);
  }
  if (metrics.length > MAX_BATCH) {
    return fail(`单次最多 ${MAX_BATCH} 条`, ErrorCode.METRIC_INVALID);
  }
  const tenantId = extractTenantId(event);
  // 校验
  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    if (!m || !m.name) {
      return fail(`第 ${i} 条 name 必填`, ErrorCode.METRIC_INVALID);
    }
    if (typeof m.value !== 'number' || isNaN(m.value)) {
      return fail(`第 ${i} 条 value 必须是数字`, ErrorCode.METRIC_INVALID);
    }
    metrics[i].tenantId = m.tenantId || tenantId;
  }
  const result = await reportBatch(db, metrics);
  logger.info('metrics reported', { count: result.inserted, tenantId });
  return ok({ inserted: result.inserted, serverTime: Date.now() });
});
