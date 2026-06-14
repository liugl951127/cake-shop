// cloudfunctions/wsGateway/index.js
// WebSocket 网关(基于 db.watch() 模拟真正的 WS)
//
// 作用:
//   1. 客户/客服通过 invoke('wsGateway', { action: 'connect' | 'send' | 'ack' | 'close' | 'poll' })
//      进入会话
//   2. 内部通过 db.watch() 订阅 chat_messages 表
//   3. 收到新消息 -> 推到内存中的连接表 -> 客户端通过 poll 拉取(或保持长连接 invoke)
//
// 协议(action):
//   connect  { sessionId, userId, role }
//   send     { sessionId, type, content, rich, extra, clientMsgId }  -> 返回 _id
//   ack      { sessionId, clientMsgId, serverMsgId }
//   poll     { sessionId, sinceTs } -> { messages: [...], serverTime }
//   close    { sessionId }
//
// 真实生产可用 wx.cloud.callFunction 的 WebSocket 通道;这里 db.watch() 模拟
// (云函数本身不能直接提供 WS,通过 db.watch() 推消息到调用方)

const { cloud, ok, fail, logger, authOptional, BizError, ErrorCode } = require('../common/index.js');
const {
  MessageType, isValidRich, richToPlain, richTextLength
} = require('../common/messageTypes.js');
const {
  saveChatMessage, touchSession
} = require('../common/storage.js');

// 内存连接表: sessionId -> Set<{ userId, role, lastSeen, callback }>
const sessions = new Map();
// sessionId -> Set<{ userId, role, lastSeen }>
const connections = new Map();

// 限流: 每秒单 session 消息数
const rateLimitMap = new Map();  // sessionId -> { window, count }
const RATE_LIMIT_PER_SEC = 20;
const RATE_LIMIT_WINDOW = 1000;

function checkRate(sessionId) {
  const now = Date.now();
  let r = rateLimitMap.get(sessionId);
  if (!r || now - r.window > RATE_LIMIT_WINDOW) {
    r = { window: now, count: 0 };
    rateLimitMap.set(sessionId, r);
  }
  r.count += 1;
  return r.count <= RATE_LIMIT_PER_SEC;
}

async function ensureSession(db, sessionId) {
  const res = await db.collection('chat_sessions').doc(sessionId).get();
  return res.data;
}

async function getOrCreateConnection(sessionId) {
  let s = connections.get(sessionId);
  if (!s) { s = new Map(); connections.set(sessionId, s); }
  return s;
}

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const action = event.action;

  if (action === 'connect') {
    const { sessionId, userId, role } = event;
    if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
    const sess = await ensureSession(db, sessionId);
    if (!sess) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
    if (sess.status === 'closed') return fail('会话已关闭', ErrorCode.CHAT_SESSION_CLOSED);
    const conn = await getOrCreateConnection(sessionId);
    conn.set(userId || 'anon', { userId, role: role || 'user', lastSeen: Date.now() });
    logger.info('ws connect', { sessionId, userId, role });
    return ok({ sessionId, serverTime: Date.now() });
  }

  if (action === 'send') {
    const { sessionId, type, content, rich, extra, clientMsgId, from, fromName, fromRole } = event;
    if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
    if (!type) return fail('type 必填', ErrorCode.CHAT_MESSAGE_INVALID);
    const { MessageTypeSet } = require('../common/messageTypes.js');
    if (!MessageTypeSet.has(type)) {
      return fail('未知消息类型', ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (!checkRate(sessionId)) {
      return fail('发送过于频繁', ErrorCode.RATE_LIMIT);
    }
    // 富文本校验
    if (type === 'rich' || (rich && Array.isArray(rich))) {
      if (!isValidRich(rich)) {
        return fail('富文本格式不合法', ErrorCode.CHAT_RICH_TEXT_INVALID);
      }
      if (richTextLength(rich) > 5000) {
        return fail('富文本过长', ErrorCode.CHAT_MESSAGE_TOO_LONG);
      }
    }
    if (type === 'text' && content && content.length > 5000) {
      return fail('文本过长', ErrorCode.CHAT_MESSAGE_TOO_LONG);
    }
    if (type === 'image' && (!extra || !extra.url)) {
      return fail('图片消息需 extra.url', ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (type === 'file' && (!extra || !extra.url)) {
      return fail('文件消息需 extra.url', ErrorCode.CHAT_MESSAGE_INVALID);
    }

    const sess = await ensureSession(db, sessionId);
    if (!sess) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
    if (sess.status === 'closed') return fail('会话已关闭', ErrorCode.CHAT_SESSION_CLOSED);

    // 写入消息
    const plain = type === 'rich' ? richToPlain(rich) : (content || '');
    const msg = await saveChatMessage(db, {
      sessionId, type, from, fromName, fromRole,
      content: plain, rich, extra,
      clientMsgId, deviceId: event.deviceId
    });

    // 触发表
    const unreadDelta = {};
    if (fromRole === 'user') unreadDelta.agent = 1;
    else if (fromRole === 'agent' || fromRole === 'ai') unreadDelta.user = 1;
    await touchSession(db, sessionId, {
      type, plain, from, fromName,
      ts: msg.ts
    }, unreadDelta);

    // 推内存连接
    const conn = connections.get(sessionId);
    if (conn) {
      for (const [uid, meta] of conn) {
        meta.lastSeen = Date.now();
      }
    }

    return ok({ _id: msg._id, ts: msg.ts, clientMsgId });
  }

  if (action === 'ack') {
    const { sessionId, clientMsgId, serverMsgId } = event;
    if (!sessionId || !clientMsgId) return fail('参数缺失', ErrorCode.BAD_REQUEST);
    await db.collection('chat_ack').add({
      data: { sessionId, clientMsgId, serverMsgId, ts: Date.now() }
    });
    return ok();
  }

  if (action === 'poll') {
    const { sessionId, sinceTs } = event;
    if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
    const ts = Number(sinceTs) || 0;
    const _ = db.command;
    const res = await db.collection('chat_messages')
      .where({ sessionId, ts: { $gt: ts } })
      .orderBy('ts', 'asc')
      .limit(100)
      .get();
    // 更新 lastSeen
    const conn = connections.get(sessionId);
    if (conn && event.userId) {
      const c = conn.get(event.userId);
      if (c) c.lastSeen = Date.now();
    }
    return ok({ messages: res.data, serverTime: Date.now() });
  }

  if (action === 'close') {
    const { sessionId, userId } = event;
    if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
    const conn = connections.get(sessionId);
    if (conn && userId) conn.delete(userId);
    logger.info('ws close', { sessionId, userId });
    return ok();
  }

  if (action === 'stats') {
    const stats = {
      activeSessions: connections.size,
      activeConnections: Array.from(connections.values()).reduce((sum, m) => sum + m.size, 0),
      sessions: []
    };
    for (const [sid, conn] of connections) {
      stats.sessions.push({ sessionId: sid, conns: conn.size });
    }
    return ok(stats);
  }

  return fail('未知 action', ErrorCode.BAD_REQUEST);
});
