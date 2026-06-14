// closeChatSession - 结束会话
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { sessionId, reason = '' } = event;
  if (!sessionId) throw new BizError('sessionId 必填');

  const db = cloud.database();
  const session = await db.collection('chatSessions').where({ sessionId }).limit(1).get();
  if (!session.data[0]) throw new BizError('会话不存在');
  const s = session.data[0];

  if (s._openid !== event._openid && !event._isAdmin) {
    throw new BizError('无权操作');
  }

  await db.collection('chatSessions').doc(s._id).update({
    data: { status: 3, closeReason: reason, closeTime: Date.now(), updateTime: Date.now() }
  });

  return ok();
});
