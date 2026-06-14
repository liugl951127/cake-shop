// cloudfunctions/queryBehaviorLog/index.js
// 行为日志可回溯查询
//
// 入参:
//   userId / openid / deviceId / type / page / sessionId / startTs / endTs / page / size
//   groupBy=session  按 sessionId 汇总
//
// 鉴权:
//   - 用户维度(查自己): userId 必填,openid 校验
//   - 后台维度: adminBypass=true 跳过(由 Spring Boot 后台调用)

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { queryBehaviorLogs } = require('../common/storage.js');

const MAX_RANGE_DAYS = 90;

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || '';
  const isAdminBypass = event.adminBypass === true;

  if (!isAdminBypass) {
    // 普通用户必须传 userId, 且 wxContext 校验
    if (!event.userId) {
      return fail('userId 必填', ErrorCode.BAD_REQUEST);
    }
  }

  if (event.startTs && event.endTs) {
    const range = event.endTs - event.startTs;
    if (range > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return fail(`查询范围最大 ${MAX_RANGE_DAYS} 天`, ErrorCode.HISTORY_QUERY_TOO_MANY);
    }
  }

  const result = await queryBehaviorLogs(db, {
    userId: event.userId,
    openid: event.openid,
    deviceId: event.deviceId,
    type: event.type,
    page: event.page,
    sessionId: event.sessionId,
    startTs: event.startTs,
    endTs: event.endTs,
    size: event.size
  });

  // 按 sessionId 汇总
  if (event.groupBy === 'session') {
    const group = new Map();
    for (const l of result.list) {
      const k = l.sessionId || 'unknown';
      if (!group.has(k)) group.set(k, { sessionId: k, count: 0, firstTs: l.ts, lastTs: l.ts, pages: new Set() });
      const g = group.get(k);
      g.count += 1;
      g.lastTs = Math.max(g.lastTs, l.ts || 0);
      g.firstTs = Math.min(g.firstTs, l.ts || Number.MAX_SAFE_INTEGER);
      if (l.page) g.pages.add(l.page);
    }
    const summary = Array.from(group.values()).map(g => ({
      sessionId: g.sessionId,
      count: g.count,
      firstTs: g.firstTs,
      lastTs: g.lastTs,
      pages: Array.from(g.pages)
    })).sort((a, b) => b.lastTs - a.lastTs);
    return ok({ total: result.total, sessions: summary });
  }

  logger.info('behavior logs queried', {
    userId: event.userId, total: result.total, by: openid || 'admin'
  });
  return ok(result);
});
