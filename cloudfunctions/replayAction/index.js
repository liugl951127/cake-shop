// cloudfunctions/replayAction/index.js
// 操作回放 - 给定 auditId, 返回 before/after diff
// 鉴权: adminBypass

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { replay } = require('../common/audit.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (event.adminBypass !== true) {
    return fail('仅供管理后台调用', ErrorCode.PERMISSION_DENIED);
  }
  const auditId = event.auditId;
  if (!auditId) return fail('auditId 必填', ErrorCode.BAD_REQUEST);

  const result = await replay(db, auditId);
  if (!result) return fail('审计记录不存在', ErrorCode.NOT_FOUND);

  logger.info('action replayed', { auditId, changes: result.changes.length });
  return ok(result);
});
