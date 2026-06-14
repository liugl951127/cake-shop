// cloudfunctions/syncOfflineOp/index.js
// 客户端断线期间产生的操作,上线后批量回溯同步
//
// 入参: { batchId, clientId, sessionId?, ops:[{opId,type,payload,ts,traceId}],
//         disconnectedAt, reconnectedAt, reason, deviceInfo }
// 出参: { batchId, accepted, deduped, replayed, offlineDurationMs }

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { acceptBatch } = require('../common/offline.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (!event.batchId) return fail('batchId 必填', ErrorCode.BAD_REQUEST);
  if (!event.clientId) return fail('clientId 必填', ErrorCode.BAD_REQUEST);
  if (!Array.isArray(event.ops) || event.ops.length === 0) {
    return ok({ batchId: event.batchId, accepted: 0, deduped: 0, replayed: 0 });
  }
  try {
    const result = await acceptBatch(db, event);
    return ok(result);
  } catch (e) {
    logger.error('syncOfflineOp fail', { e: e.message });
    if (e.code != null) return fail(e.message, e.code);
    return fail(e.message || '同步失败', ErrorCode.SYSTEM_ERROR);
  }
});
