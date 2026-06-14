// cloudfunctions/monitorDashboard/index.js
// 监控大盘聚合
//   { tenantId, startTs, endTs }
// 返回: 性能统计 / 错误列表 / 关键指标

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { aggregate, aggregateErrors } = require('../common/monitor.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (event.adminBypass !== true) {
    return fail('仅供管理后台调用', ErrorCode.PERMISSION_DENIED);
  }
  const endTs = event.endTs || Date.now();
  const startTs = event.startTs || (endTs - 24 * 60 * 60 * 1000);
  const tenantId = event.tenantId;  // 不传则跨租户汇总(仅 super_admin)

  const [perf, errors] = await Promise.all([
    aggregate(db, { tenantId, startTs, endTs }),
    aggregateErrors(db, { tenantId, startTs, endTs })
  ]);

  return ok({
    timeRange: { startTs, endTs },
    perf,
    errors,
    serverTime: Date.now()
  });
});
