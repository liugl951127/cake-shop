// cloudfunctions/reportError/index.js
// 异常上报(客户端 JS 报错 / 服务端异常)
//   { message, stack, type, scene, level, context, fingerprint? }

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { reportError } = require('../common/monitor.js');
const { extractTenantId } = require('../common/tenant.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (!event.message) return fail('message 必填', ErrorCode.BAD_REQUEST);
  if ((event.message || '').length > 1000) return fail('message 过长', ErrorCode.METRIC_INVALID);
  const tenantId = extractTenantId(event);

  const result = await reportError(db, {
    message: event.message,
    stack: event.stack || '',
    type: event.type || 'Error',
    scene: event.scene || 'client',
    level: event.level || 'error',
    context: event.context || null,
    tenantId,
    userId: event.userId || '',
    deviceId: event.deviceId || ''
  });
  if (!result) return fail('上报失败', ErrorCode.SYSTEM_ERROR);
  logger.info('error reported', { msg: event.message, deduped: result.deduped });
  return ok({ _id: result._id, deduped: result.deduped });
});
