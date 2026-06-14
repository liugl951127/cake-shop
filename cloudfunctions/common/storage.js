// common/storage.js
// 聊天消息 / 行为日志 / 历史会话的存储封装
//   - chat_messages      单条消息存储
//   - chat_sessions      会话主表(参与者、最近消息、未读)
//   - behavior_logs      行为埋点(批量入库)
//   - chat_uploads       上传文件元数据(图片/文件/富文本素材)

const { num } = require('./transaction.js');
const logger = require('./logger.js').child({ m: 'storage' });

/**
 * 写一条聊天消息(写 chat_messages)
 * 字段: _id, sessionId, type, from(uid/agent/system), to, content(协议JSON或文本),
 *       rich(富文本节点数组), extra, ts, created
 */
async function saveChatMessage(db, msg) {
  if (!msg || !msg.sessionId) throw new Error('sessionId required');
  if (!msg.type) msg.type = 'text';
  if (!msg.from) msg.from = 'system';
  const now = Date.now();
  const doc = {
    sessionId: msg.sessionId,
    type: msg.type,
    from: msg.from,
    fromName: msg.fromName || '',
    fromRole: msg.fromRole || 'user',         // user/agent/ai/system
    to: msg.to || '',
    content: msg.content || '',
    rich: msg.rich || null,                   // 富文本节点数组
    extra: msg.extra || null,                 // 产品卡/订单卡/文件等
    clientMsgId: msg.clientMsgId || '',
    ip: msg.ip || '',
    deviceId: msg.deviceId || '',
    ts: msg.ts || now,
    created: now
  };
  const res = await db.collection('chat_messages').add({ data: doc });
  doc._id = res._id;
  return doc;
}

/**
 * 批量写行为日志(用于行为埋点)
 * 字段: _id, userId, openid, deviceId, scene, type, page, element, payload, ts
 */
async function saveBehaviorLogs(db, logs) {
  if (!Array.isArray(logs) || logs.length === 0) return { inserted: 0 };
  const now = Date.now();
  const docs = logs.map(l => ({
    userId: l.userId || null,
    openid: l.openid || null,
    deviceId: l.deviceId || '',
    scene: l.scene || 'miniprogram',
    sessionId: l.sessionId || null,
    type: l.type,
    page: l.page || '',
    element: l.element || '',
    payload: l.payload || null,
    ip: l.ip || '',
    ua: l.ua || '',
    referer: l.referer || '',
    ts: l.ts || now,
    created: now
  }));
  // 云开发每次最多 1000 条
  let total = 0;
  for (let i = 0; i < docs.length; i += 100) {
    const slice = docs.slice(i, i + 100);
    await db.collection('behavior_logs').add({ data: slice });
    total += slice.length;
  }
  logger.info('behavior logs inserted', { count: total });
  return { inserted: total };
}

/**
 * 更新会话(最近消息、未读)
 */
async function touchSession(db, sessionId, lastMessage, unreadDelta = {}) {
  const _ = db.command;
  const update = {
    lastMessage,
    lastTs: Date.now(),
    updatedAt: Date.now()
  };
  if (unreadDelta.user) update['unread.user'] = _.inc(unreadDelta.user);
  if (unreadDelta.agent) update['unread.agent'] = _.inc(unreadDelta.agent);
  await db.collection('chat_sessions').doc(sessionId).update({ data: update });
}

/**
 * 历史消息查询(可回溯)
 *  支持: sessionId, userId, type, keyword(全文), from, 时间段, 分页
 */
async function queryChatMessages(db, params = {}) {
  const _ = db.command;
  const w = {};
  if (params.sessionId) w.sessionId = params.sessionId;
  if (params.userId) w['from'] = params.userId;          // 简化: 也可在 extra 里加
  if (params.type) w.type = params.type;
  if (params.from) w.from = params.from;
  if (params.startTs || params.endTs) {
    w.ts = {};
    if (params.startTs) w.ts['$gte'] = params.startTs;
    if (params.endTs) w.ts['$lte'] = params.endTs;
  }
  if (params.keyword) {
    // 全文模糊(content 是 text 消息的文本,rich 走 richToPlain 后比较)
    // 云开发正则查询要 + database.regexp,这里用 $regex
    w.content = { $regex: params.keyword };
  }

  const page = num(params.page, 1);
  const size = Math.min(num(params.size, 50), 500);
  const skip = (page - 1) * size;

  const coll = db.collection('chat_messages');
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll
    .where(w)
    .orderBy('ts', 'desc')
    .skip(skip)
    .limit(size)
    .get()
    .then(r => r.data);
  return { total, list, page, size };
}

/**
 * 行为日志查询(可回溯)
 */
async function queryBehaviorLogs(db, params = {}) {
  const _ = db.command;
  const w = {};
  if (params.userId) w.userId = params.userId;
  if (params.openid) w.openid = params.openid;
  if (params.deviceId) w.deviceId = params.deviceId;
  if (params.type) w.type = params.type;
  if (params.page) w.page = params.page;
  if (params.sessionId) w.sessionId = params.sessionId;
  if (params.startTs || params.endTs) {
    w.ts = {};
    if (params.startTs) w.ts['$gte'] = params.startTs;
    if (params.endTs) w.ts['$lte'] = params.endTs;
  }

  const page = num(params.page, 1);
  const size = Math.min(num(params.size, 50), 500);
  const skip = (page - 1) * size;

  const coll = db.collection('behavior_logs');
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll
    .where(w)
    .orderBy('ts', 'desc')
    .skip(skip)
    .limit(size)
    .get()
    .then(r => r.data);
  return { total, list, page, size };
}

/**
 * 记录上传文件元数据
 */
async function saveUploadMeta(db, meta) {
  const doc = {
    fileId: meta.fileId,
    url: meta.url,
    name: meta.name || '',
    mime: meta.mime || '',
    size: meta.size || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    scope: meta.scope || 'chat',     // chat / behavior / rich
    uploader: meta.uploader || '',
    scene: meta.scene || 'miniprogram',
    created: Date.now()
  };
  const res = await db.collection('chat_uploads').add({ data: doc });
  return { ...doc, _id: res._id };
}

module.exports = {
  saveChatMessage,
  saveBehaviorLogs,
  touchSession,
  queryChatMessages,
  queryBehaviorLogs,
  saveUploadMeta
};
