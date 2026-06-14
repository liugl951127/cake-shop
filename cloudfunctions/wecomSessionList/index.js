// cloudfunctions/wecomSessionList/index.js
// 企微会话列表(客服台用)
//   - 列出 chat_sessions 中 transferredToWeCom=true 且未关闭
//   - 关联 chat_messages 拿最近消息 + 未读数
//   - 支持按 openKfId / externalUserId 过滤

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { Status } = require('../common/session.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (event.adminBypass !== true && !event.agentId) {
    return fail('需要 adminBypass 或 agentId', ErrorCode.PERMISSION_DENIED);
  }
  const page = Number(event.page) || 1;
  const size = Math.min(Number(event.size) || 30, 100);
  const skip = (page - 1) * size;

  const w = { transferredToWeCom: true };
  // 默认查未关闭
  if (!event.includeClosed) {
    w.status = db.command.neq(Status.CLOSED);
  }
  if (event.openKfId) w.transferredKfId = event.openKfId;
  if (event.servicerUserId) w.servicerUserId = event.servicerUserId;

  const coll = db.collection('chat_sessions');
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll.where(w)
    .orderBy('lastTs', 'desc')
    .skip(skip)
    .limit(size)
    .get()
    .then(r => r.data);

  // 关联客户信息
  const result = [];
  for (const s of list) {
    let lastMessages = [];
    if (s.lastMessage || s.lastTs) {
      try {
        const m = await db.collection('chat_messages')
          .where({ sessionId: s._id })
          .orderBy('ts', 'desc')
          .limit(3)
          .get();
        lastMessages = m.data || [];
      } catch (e) {}
    }
    result.push({
      ...s,
      recentMessages: lastMessages.reverse()
    });
  }

  return ok({ total, list: result, page, size });
});
