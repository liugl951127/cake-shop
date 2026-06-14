// common/session.js
// 会话状态机 + 生命周期
//   - 7 状态: pending -> ai -> agent -> transferred -> closed -> archived
//   - 主动挂断: client_hangup / agent_hangup / system_timeout
//   - 评价: 仅 closed 状态可评
//   - 转接: 仅 agent 状态可转

const { logger } = require('./logger.js');
const { ErrorCode, BizError } = require('./errors.js');

const Status = {
  PENDING: 'pending',              // 待分配
  AI: 'ai',                        // AI 客服
  AGENT: 'agent',                  // 人工客服
  TRANSFERRED: 'transferred',      // 已转接(企微/电话)
  WAITING: 'waiting',              // 等待(空闲无客服)
  CLOSED: 'closed',                // 已关闭
  ARCHIVED: 'archived'             // 已归档
};

const HangupBy = {
  CLIENT: 'client',                // 客户主动
  AGENT: 'agent',                  // 客服主动
  SYSTEM_TIMEOUT: 'system_timeout',// 超时自动
  TRANSFER: 'transfer',            // 转接关闭
  EXTERNAL: 'external'             // 外部(企微端关闭)
};

const RATE_LIMIT_REPLY = { windowMs: 1000, max: 5 };

// 内存级限流
const rateMap = new Map();
function checkReplyRate(sessionId) {
  const now = Date.now();
  let r = rateMap.get(sessionId);
  if (!r || now - r.window > RATE_LIMIT_REPLY.windowMs) {
    r = { window: now, count: 0 };
    rateMap.set(sessionId, r);
  }
  r.count += 1;
  return r.count <= RATE_LIMIT_REPLY.max;
}

/**
 * 校验转换(状态机)
 */
const TRANSITIONS = {
  [Status.PENDING]:     [Status.AI, Status.AGENT, Status.WAITING, Status.CLOSED],
  [Status.AI]:          [Status.AGENT, Status.TRANSFERRED, Status.CLOSED],
  [Status.AGENT]:       [Status.TRANSFERRED, Status.CLOSED, Status.WAITING],
  [Status.WAITING]:     [Status.AGENT, Status.CLOSED],
  [Status.TRANSFERRED]: [Status.CLOSED, Status.ARCHIVED],
  [Status.CLOSED]:      [Status.ARCHIVED],
  [Status.ARCHIVED]:    []
};

function canTransition(from, to) {
  const allow = TRANSITIONS[from] || [];
  return allow.includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new BizError(ErrorCode.SESSION_ALREADY_CLOSED, `无法从 ${from} 转到 ${to}`);
  }
}

/**
 * 客户主动挂断
 *   - 已 closed -> 报错
 *   - 状态转到 closed
 *   - 记录挂断原因/挂断人
 *   - 不影响评分(评分可异步发起)
 */
async function clientHangup(db, sessionId, userId, reason = 'client_request') {
  if (!sessionId) throw new BizError(ErrorCode.BAD_REQUEST, 'sessionId 必填');
  const sessRes = await db.collection('chat_sessions').doc(sessionId).get();
  if (!sessRes.data) throw new BizError(ErrorCode.CHAT_SESSION_NOT_FOUND);
  const sess = sessRes.data;
  if (sess.status === Status.CLOSED || sess.status === Status.ARCHIVED) {
    throw new BizError(ErrorCode.SESSION_ALREADY_CLOSED);
  }
  if (sess.userId && userId && sess.userId !== userId) {
    throw new BizError(ErrorCode.SESSION_NO_PERMISSION);
  }

  const now = Date.now();
  await db.collection('chat_sessions').doc(sessionId).update({
    data: {
      status: Status.CLOSED,
      closedAt: now,
      closedBy: HangupBy.CLIENT,
      hangupReason: reason,
      hangupAt: now,
      updatedAt: now
    }
  });

  // 写一条系统消息
  try {
    await db.collection('chat_messages').add({
      data: {
        sessionId,
        type: 'system',
        from: 'system',
        fromRole: 'system',
        content: '客户已结束本次咨询,感谢您的支持!',
        ts: now, created: now
      }
    });
  } catch (e) { /* ignore */ }

  logger.info('session client hangup', { sessionId, userId, reason });
  return {
    sessionId,
    status: Status.CLOSED,
    closedBy: HangupBy.CLIENT,
    reason,
    closedAt: now
  };
}

/**
 * 客服主动挂断
 *   - 校验 agent 权限
 *   - 状态转 closed
 *   - 通知客户(系统消息)
 */
async function agentHangup(db, sessionId, agentId, reason = 'agent_request') {
  if (!sessionId) throw new BizError(ErrorCode.BAD_REQUEST, 'sessionId 必填');
  const sessRes = await db.collection('chat_sessions').doc(sessionId).get();
  if (!sessRes.data) throw new BizError(ErrorCode.CHAT_SESSION_NOT_FOUND);
  const sess = sessRes.data;
  if (sess.status === Status.CLOSED || sess.status === Status.ARCHIVED) {
    throw new BizError(ErrorCode.SESSION_ALREADY_CLOSED);
  }
  if (sess.agentId && agentId && sess.agentId !== agentId) {
    throw new BizError(ErrorCode.SESSION_NO_PERMISSION);
  }

  const now = Date.now();
  await db.collection('chat_sessions').doc(sessionId).update({
    data: {
      status: Status.CLOSED,
      closedAt: now,
      closedBy: HangupBy.AGENT,
      hangupReason: reason,
      hangupAt: now,
      updatedAt: now
    }
  });
  try {
    await db.collection('chat_messages').add({
      data: {
        sessionId,
        type: 'system',
        from: 'system',
        fromRole: 'system',
        content: '客服已结束本次服务,感谢您的咨询!',
        ts: now, created: now
      }
    });
  } catch (e) {}
  logger.info('session agent hangup', { sessionId, agentId, reason });
  return {
    sessionId, status: Status.CLOSED,
    closedBy: HangupBy.AGENT, reason, closedAt: now
  };
}

/**
 * 通用挂断(参数化)
 */
async function hangup(db, sessionId, by, operatorId, reason) {
  if (by === HangupBy.CLIENT) return clientHangup(db, sessionId, operatorId, reason);
  if (by === HangupBy.AGENT) return agentHangup(db, sessionId, operatorId, reason);
  throw new BizError(ErrorCode.HANGUP_NOT_ALLOWED, '不支持的挂断方');
}

module.exports = {
  Status,
  HangupBy,
  RATE_LIMIT_REPLY,
  canTransition,
  assertTransition,
  clientHangup,
  agentHangup,
  hangup,
  checkReplyRate
};
