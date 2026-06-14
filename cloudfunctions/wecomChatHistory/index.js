// cloudfunctions/wecomChatHistory/index.js
// 企微会话聊天历史(客服台查看完整记录)
//   - 按 sessionId 拉 chat_messages
//   - 倒序 + 分页
//   - 可选 keyword 模糊匹配

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (event.adminBypass !== true && !event.agentId) {
    return fail('需要 adminBypass 或 agentId', ErrorCode.PERMISSION_DENIED);
  }
  const sessionId = event.sessionId;
  if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
  const page = Number(event.page) || 1;
  const size = Math.min(Number(event.size) || 50, 200);
  const skip = (page - 1) * size;

  const w = { sessionId };
  if (event.keyword) {
    w.content = { $regex: event.keyword };
  }
  const coll = db.collection('chat_messages');
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll.where(w)
    .orderBy('ts', 'desc')
    .skip(skip)
    .limit(size)
    .get()
    .then(r => r.data);
  return ok({ total, list: list.reverse(), page, size });
});
