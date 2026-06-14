// cloudfunctions/exportHistory/index.js
// 历史消息/行为日志 批量导出(后台/Spring Boot 调)
//
// 入参:
//   type = 'chat' | 'behavior'
//   sessionId / userId / startTs / endTs
//   format = 'json' | 'csv'(目前只实现 json)
//
// 限制: 最多 5000 条,单次响应
//      超量返回 marker, 前端分批拉

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { queryChatMessages, queryBehaviorLogs } = require('../common/storage.js');

const MAX_EXPORT = 5000;

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const type = event.type || 'chat';
  const startTs = Number(event.startTs) || 0;
  const endTs = Number(event.endTs) || Date.now();

  // 必须有"管理员标识"(由 Spring Boot 后台调用,带 adminBypass)
  if (event.adminBypass !== true) {
    return fail('仅供管理后台调用', ErrorCode.PERMISSION_DENIED);
  }

  let result;
  if (type === 'chat') {
    result = await queryChatMessages(db, {
      sessionId: event.sessionId,
      startTs, endTs,
      page: 1, size: MAX_EXPORT
    });
  } else if (type === 'behavior') {
    result = await queryBehaviorLogs(db, {
      userId: event.userId, openid: event.openid,
      deviceId: event.deviceId, type: event.eventType,
      startTs, endTs,
      page: 1, size: MAX_EXPORT
    });
  } else {
    return fail('type 必须是 chat / behavior', ErrorCode.BAD_REQUEST);
  }

  logger.info('history exported', {
    type, count: result.list.length, total: result.total,
    by: event.userId || 'admin'
  });

  if (result.total > MAX_EXPORT) {
    return ok({
      truncated: true,
      returned: result.list.length,
      total: result.total,
      nextStartTs: result.list.length > 0
        ? (type === 'chat' ? result.list[result.list.length - 1].ts : result.list[result.list.length - 1].ts)
        : endTs,
      data: result.list
    });
  }

  return ok({
    truncated: false,
    returned: result.list.length,
    total: result.total,
    data: result.list
  });
});
