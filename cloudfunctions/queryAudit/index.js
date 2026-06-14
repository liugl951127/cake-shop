// cloudfunctions/queryAudit/index.js
// 审计日志查询
// 鉴权: adminBypass 后台调用 / super_admin 直接看

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { queryAuditLogs } = require('../common/audit.js');
const { assertTenantActive, extractTenantId } = require('../common/tenant.js');

const MAX_RANGE_DAYS = 90;

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const tenantId = extractTenantId(event);
  const isAdminBypass = event.adminBypass === true;

  if (!isAdminBypass) {
    // 非管理端要求登录
    if (!event.userId) return fail('userId 必填', ErrorCode.BAD_REQUEST);
  }
  // 校验租户(在管理端也可以跨租户查)
  if (!isAdminBypass) {
    await assertTenantActive(db, tenantId);
  }
  if (event.startTs && event.endTs) {
    const range = event.endTs - event.startTs;
    if (range > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return fail(`查询范围最大 ${MAX_RANGE_DAYS} 天`, ErrorCode.HISTORY_QUERY_TOO_MANY);
    }
  }

  const result = await queryAuditLogs(db, {
    tenantId: isAdminBypass ? (event.tenantId || undefined) : tenantId,
    action: event.action,
    operatorId: event.operatorId,
    targetType: event.targetType,
    targetId: event.targetId,
    severity: event.severity,
    startTs: event.startTs,
    endTs: event.endTs,
    page: event.page,
    size: event.size
  });
  logger.info('audit logs queried', {
    by: event.userId || 'admin', total: result.total
  });
  return ok(result);
});
