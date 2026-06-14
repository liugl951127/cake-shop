// cloudfunctions/queryChatHistory/index.js
// 聊天历史可回溯查询
//
// 入参:
//   sessionId    必填
//   keyword      全文(模糊匹配 content)
//   type         消息类型
//   from         发送方 userId
//   startTs      起始毫秒
//   endTs        截止毫秒
//   page         默认 1
//   size         默认 50,最大 500
//   withRich     true 时返回富文本节点
//
// 鉴权: 仅会话参与方(user 角色 = 该会话 userId;agent 角色 = 客服)可看
//       客服/管理员 走 adminBypass=true 跳过(由 Spring Boot 后台调用)

const { cloud, ok, fail, logger, authOptional, ErrorCode, BizError } = require('../common/index.js');
const { queryChatMessages } = require('../common/storage.js');

const MAX_RANGE_DAYS = 90;
const MAX_PAGE_SIZE = 500;

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const sessionId = event.sessionId;
  if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);

  // 范围限制
  if (event.startTs && event.endTs) {
    const range = event.endTs - event.startTs;
    if (range > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return fail(`查询范围最大 ${MAX_RANGE_DAYS} 天`, ErrorCode.HISTORY_QUERY_TOO_MANY);
    }
  }

  // 鉴权
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || '';
  const isAdminBypass = event.adminBypass === true;

  if (!isAdminBypass) {
    const sessRes = await db.collection('chat_sessions').doc(sessionId).get();
    if (!sessRes.data) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
    const sess = sessRes.data;
    const isUser = sess.userId && (openid === sess.openid || event.userId === sess.userId);
    const isAgent = sess.agentId && (event.userId === sess.agentId);
    if (!isUser && !isAgent) {
      return fail('非会话参与方', ErrorCode.CHAT_NOT_PARTICIPANT);
    }
  }

  // 限制 size
  const size = Math.min(Number(event.size) || 50, MAX_PAGE_SIZE);

  const result = await queryChatMessages(db, {
    sessionId,
    type: event.type,
    from: event.from,
    userId: event.userId,
    startTs: event.startTs,
    endTs: event.endTs,
    keyword: event.keyword,
    page: event.page,
    size
  });

  // withRich=false 时不返回 rich 节点
  if (event.withRich === false) {
    result.list = result.list.map(m => {
      const { rich, ...rest } = m;
      return rest;
    });
  }

  logger.info('chat history queried', {
    sessionId, total: result.total, page: result.page, size, by: openid || event.userId
  });
  return ok(result);
});
