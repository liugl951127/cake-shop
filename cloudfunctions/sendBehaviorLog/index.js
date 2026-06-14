// cloudfunctions/sendBehaviorLog/index.js
// 客户端行为埋点入口(批量上报)
//
// 入参: { logs: [{ type, page, element, payload, ts }], sessionId? }
// 限制: 单次最多 100 条,单条 payload < 5KB
// 鉴权: 允许匿名(未登录也能上报 deviceId 维度),但记录 userId/openid

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { saveBehaviorLogs } = require('../common/storage.js');
const { MessageTypeSet, MessageType } = require('../common/messageTypes.js');

const MAX_BATCH = 100;
const MAX_PAYLOAD = 5 * 1024;

exports.main = authOptional(async (event, context) => {
  const logs = event.logs;
  const sessionId = event.sessionId || null;
  if (!Array.isArray(logs) || logs.length === 0) {
    return fail('logs 必填', ErrorCode.BAD_REQUEST);
  }
  if (logs.length > MAX_BATCH) {
    return fail(`单次最多 ${MAX_BATCH} 条`, ErrorCode.BEHAVIOR_LOG_TOO_LARGE);
  }
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid || null;
  const userId = event.userId || null;
  const deviceId = event.deviceId || '';
  const scene = event.scene || 'miniprogram';
  const ip = event.ip || (wxContext.SOURCE_IP) || '';
  const ua = event.ua || '';

  // 校验
  const out = [];
  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    if (!l || typeof l !== 'object') {
      return fail(`第 ${i} 条不是对象`, ErrorCode.BEHAVIOR_LOG_INVALID);
    }
    if (!l.type || !MessageTypeSet.has(l.type)) {
      return fail(`第 ${i} 条 type 非法: ${l.type}`, ErrorCode.BEHAVIOR_LOG_INVALID);
    }
    if (l.payload && (typeof l.payload !== 'object')) {
      return fail(`第 ${i} 条 payload 必须是对象`, ErrorCode.BEHAVIOR_LOG_INVALID);
    }
    const payloadStr = l.payload ? JSON.stringify(l.payload) : '';
    if (payloadStr.length > MAX_PAYLOAD) {
      return fail(`第 ${i} 条 payload 超过 5KB`, ErrorCode.BEHAVIOR_LOG_TOO_LARGE);
    }
    out.push({
      type: l.type,
      page: l.page || '',
      element: l.element || '',
      payload: l.payload || null,
      ts: l.ts || Date.now(),
      userId, openid, deviceId, scene, sessionId, ip, ua
    });
  }

  const result = await saveBehaviorLogs(cloud.database(), out);
  logger.info('behavior logs accepted', {
    count: result.inserted,
    openid, deviceId, scene
  });
  return ok({ inserted: result.inserted, serverTime: Date.now() });
});
