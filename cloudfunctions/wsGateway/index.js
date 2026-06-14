// cloudfunctions/wsGateway/index.js
// WebSocket 网关 v2(基于 db.watch() 模拟真正的 WS)
//
// 作用:
//   1. 客户/客服通过 invoke('wsGateway', { action: 'connect' | 'send' | 'ack' | 'poll' | 'close' | 'stats' | 'heartbeat' | 'disconnect' | 'disconnectHistory' })
//      进入会话
//   2. 内部通过 db.watch() 订阅 chat_messages 表
//   3. 收到新消息 -> 推到内存中的连接表 -> 客户端通过 poll 拉取(或保持长连接 invoke)
//   4. 兼容: 心跳超时检测 / 主动断线记录 / 设备能力上报
//
// 协议(action):
//   connect            { sessionId, userId, role, deviceInfo }
//   send               { sessionId, type, content, rich, extra, clientMsgId }  -> 返回 _id
//   ack                { sessionId, clientMsgId, serverMsgId }
//   poll               { sessionId, sinceTs } -> { messages: [...], serverTime }
//   heartbeat          { sessionId, userId, ts, network }
//   disconnect         { sessionId, userId, reason, durationMs, network }  主动断线记录
//   disconnectHistory  { userId }  查该用户的断线记录
//   close              { sessionId }
//   stats              -> { activeSessions, ..., totalDisconnects }

const { cloud, ok, fail, logger, authOptional, BizError, ErrorCode } = require('../common/index.js');
const {
  MessageType, MessageTypeSet, isValidRich, richToPlain, richTextLength, getRequiredScopes
} = require('../common/messageTypes.js');
const {
  saveChatMessage, touchSession
} = require('../common/storage.js');
const { normalizeDevice } = require('../common/device.js');
const authz = require('../common/auth.js');

// 内存连接表: sessionId -> Map<userId, meta>
const connections = new Map();

// 心跳配置
const HEARTBEAT_TIMEOUT = 30 * 1000;
const HEARTBEAT_INTERVAL = 10 * 1000;

// 限流
const rateLimitMap = new Map();
const RATE_LIMIT_PER_SEC = 20;
const RATE_LIMIT_WINDOW = 1000;

// 客户端断线状态
const clientState = new Map();  // clientKey -> { disconnects, connectedAt, lastDisconnect }

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

function reapTimeoutConnections() {
  const now = Date.now();
  let closed = 0;
  for (const [sessionId, conn] of connections) {
    for (const [uid, meta] of conn) {
      if (now - meta.lastSeen > HEARTBEAT_TIMEOUT) {
        const clientKey = `${uid}:${sessionId}`;
        const state = clientState.get(clientKey) || {};
        if (!state.timeoutRecorded) {
          state.timeoutRecorded = true;
          state.lastDisconnect = {
            at: now,
            reason: 'heartbeat_timeout',
            durationMs: now - (state.connectedAt || now)
          };
        }
        conn.delete(uid);
        closed += 1;
      }
    }
  }
  if (closed > 0) logger.info('ws reaped timeout', { count: closed });
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
    const { sessionId, userId, role, deviceInfo } = event;
    if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
    const sess = await ensureSession(db, sessionId);
    if (!sess) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
    if (sess.status === 'closed') return fail('会话已关闭', ErrorCode.CHAT_SESSION_CLOSED);

    let device = null;
    if (deviceInfo) {
      try { device = normalizeDevice({ deviceInfo }); } catch (e) { device = null; }
    }

    const conn = await getOrCreateConnection(sessionId);
    const now = Date.now();
    const isReconnect = conn.has(userId || 'anon');
    const prev = isReconnect ? conn.get(userId || 'anon') : null;
    conn.set(userId || 'anon', {
      userId, role: role || 'user',
      lastSeen: now,
      connectedAt: now,
      reconnects: prev ? (prev.reconnects || 0) + 1 : 0,
      device
    });

    const clientKey = `${userId || 'anon'}:${sessionId}`;
    const state = clientState.get(clientKey) || { disconnects: [] };
    state.connectedAt = now;
    state.timeoutRecorded = false;
    clientState.set(clientKey, state);

    logger.info('ws connect', { sessionId, userId, role, reconnect: isReconnect, device: device && device.platform });
    return ok({
      sessionId, serverTime: now,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL,
      heartbeatTimeoutMs: HEARTBEAT_TIMEOUT,
      isReconnect
    });
  }

  if (action === 'heartbeat') {
    const { sessionId, userId, ts, network } = event;
    if (!sessionId || !userId) return fail('sessionId/userId 必填', ErrorCode.BAD_REQUEST);
    const conn = connections.get(sessionId);
    if (!conn || !conn.has(userId)) {
      return fail('连接不存在', ErrorCode.WS_SESSION_LOST);
    }
    const meta = conn.get(userId);
    const now = Date.now();
    const lastSeen = meta.lastSeen;
    meta.lastSeen = now;
    if (network) meta.lastNetwork = network;

    try {
      await db.collection('ws_heartbeats').add({
        data: {
          sessionId, userId, network: network || 'unknown',
          rtt: ts ? now - ts : 0, ts: now
        }
      });
    } catch (e) { /* 不阻塞 */ }

    return ok({
      serverTime: now,
      lastSeen,
      nextHeartbeatMs: HEARTBEAT_INTERVAL,
      healthy: (now - lastSeen) < HEARTBEAT_TIMEOUT
    });
  }

  if (action === 'disconnect') {
    const { sessionId, userId, reason, durationMs, network } = event;
    if (!sessionId || !userId) return fail('sessionId/userId 必填', ErrorCode.BAD_REQUEST);
    const clientKey = `${userId}:${sessionId}`;
    const state = clientState.get(clientKey) || { disconnects: [] };
    state.disconnects.push({
      at: Date.now(),
      reason: reason || 'network',
      durationMs: Number(durationMs) || 0,
      network: network || 'unknown'
    });
    if (state.disconnects.length > 50) {
      state.disconnects = state.disconnects.slice(-50);
    }
    state.connectedAt = null;
    clientState.set(clientKey, state);

    try {
      await db.collection('ws_disconnects').add({
        data: {
          sessionId, userId, reason: reason || 'network',
          durationMs: Number(durationMs) || 0,
          network: network || 'unknown',
          ts: Date.now()
        }
      });
    } catch (e) { /* ignore */ }

    const conn = connections.get(sessionId);
    if (conn) conn.delete(userId);
    logger.info('ws disconnect reported', { sessionId, userId, reason, durationMs });
    return ok();
  }

  if (action === 'send') {
    const { sessionId, type, content, rich, extra, clientMsgId, from, fromName, fromRole } = event;
    if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
    if (!type) return fail('type 必填', ErrorCode.CHAT_MESSAGE_INVALID);
    if (!MessageTypeSet.has(type)) {
      return fail('未知消息类型', ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (!checkRate(sessionId)) {
      return fail('发送过于频繁', ErrorCode.RATE_LIMIT);
    }
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
    if (type === 'video' && (!extra || !extra.url)) {
      return fail('视频消息需 extra.url', ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (type === 'audio' && (!extra || !extra.url)) {
      return fail('音频消息需 extra.url', ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (type === 'voice' && (!extra || !extra.url)) {
      return fail('语音消息需 extra.url', ErrorCode.CHAT_MESSAGE_INVALID);
    }
    if (type === 'location') {
      if (!extra || extra.latitude == null || extra.longitude == null) {
        return fail('位置消息需 extra.latitude/longitude', ErrorCode.CHAT_MESSAGE_INVALID);
      }
      // 校验位置范围 + 精度
      try {
        authz.validateLocation({
          latitude: extra.latitude,
          longitude: extra.longitude,
          accuracy: extra.accuracy,
          scope: extra.scope || 'CN'
        });
      } catch (e) {
        if (e.code) return fail(e.message, e.code);
        return fail(e.message, ErrorCode.AUTH_LOCATION_DENIED);
      }
    }
    // 富文本中含敏感节点(图片/视频/位置等) - 服务端只校验格式
    // 客户端在 preview/download 时走资源 token 鉴权(见 getAuthToken 云函数)

    const sess = await ensureSession(db, sessionId);
    if (!sess) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
    if (sess.status === 'closed') return fail('会话已关闭', ErrorCode.CHAT_SESSION_CLOSED);

    const plain = type === 'rich' ? richToPlain(rich) : (content || '');
    const msg = await saveChatMessage(db, {
      sessionId, type, from, fromName, fromRole,
      content: plain, rich, extra,
      clientMsgId, deviceId: event.deviceId
    });

    const unreadDelta = {};
    if (fromRole === 'user') unreadDelta.agent = 1;
    else if (fromRole === 'agent' || fromRole === 'ai') unreadDelta.user = 1;
    await touchSession(db, sessionId, {
      type, plain, from, fromName, ts: msg.ts
    }, unreadDelta);

    const conn = connections.get(sessionId);
    if (conn) {
      for (const [, meta] of conn) meta.lastSeen = Date.now();
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
    const res = await db.collection('chat_messages')
      .where({ sessionId, ts: { $gt: ts } })
      .orderBy('ts', 'asc')
      .limit(100)
      .get();
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
    reapTimeoutConnections();
    const stats = {
      activeSessions: connections.size,
      activeConnections: Array.from(connections.values()).reduce((sum, m) => sum + m.size, 0),
      sessions: [],
      totalClients: clientState.size,
      totalDisconnects: Array.from(clientState.values())
        .reduce((sum, s) => sum + (s.disconnects ? s.disconnects.length : 0), 0)
    };
    for (const [sid, conn] of connections) {
      stats.sessions.push({
        sessionId: sid,
        conns: conn.size,
        devices: Array.from(conn.values()).map(c => c.device && c.device.platform)
      });
    }
    return ok(stats);
  }

  if (action === 'disconnectHistory') {
    const { userId } = event;
    const list = [];
    for (const [k, s] of clientState) {
      if (!userId || k.startsWith(userId + ':')) {
        list.push({ clientKey: k, disconnects: s.disconnects });
      }
    }
    return ok({ list });
  }

  return fail('未知 action', ErrorCode.BAD_REQUEST);
});
