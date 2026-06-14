// getChatMessages - 拉取消息历史
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  const { sessionId, page = 1, pageSize = 30, markRead = false } = event;
  if (!sessionId) throw new BizError('sessionId 必填');

  const db = cloud.database();
  const _ = db.command;

  const session = await db.collection('chatSessions').where({ sessionId }).limit(1).get();
  if (!session.data[0]) throw new BizError('会话不存在');
  const s = session.data[0];

  // 权限
  if (s._openid !== event._openid && !event._isAdmin) {
    throw new BizError('无权操作');
  }

  const res = await db.collection('chatMessages')
    .where({ sessionId })
    .orderBy('createTime', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  // 标记已读
  if (markRead) {
    const role = event._isAdmin ? 'admin' : 'user';
    if (role === 'user' && s.unreadByUser > 0) {
      await db.collection('chatSessions').doc(s._id).update({
        data: { unreadByUser: 0 }
      });
      await db.collection('chatMessages').where({
        sessionId, fromType: 'admin', status: 1
      }).update({ data: { status: 2 } });
    } else if (role === 'admin' && s.unreadByAdmin > 0) {
      await db.collection('chatSessions').doc(s._id).update({
        data: { unreadByAdmin: 0 }
      });
      await db.collection('chatMessages').where({
        sessionId, fromType: 'user', status: 1
      }).update({ data: { status: 2 } });
    }
  }

  return ok(res.data.map(m => ({
    ...m,
    timeText: formatTime(new Date(m.createTime), 'HH:mm')
  })));
});
