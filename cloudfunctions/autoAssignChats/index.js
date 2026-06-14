// autoAssignChats - 分配排队中的会话
// Cron: */1 * * * * *
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;

  // 找在线客服
  const admins = await db.collection('users')
    .where({ isAdmin: true, isOnline: true })
    .get();
  if (admins.data.length === 0) return ok({ assigned: 0 });

  // 找排队中的会话
  const waiting = await db.collection('chatSessions')
    .where({ status: 2 })
    .orderBy('createTime', 'asc')
    .limit(20)
    .get();
  if (waiting.data.length === 0) return ok({ assigned: 0 });

  let assigned = 0;
  for (const s of waiting.data) {
    // 找当前接待数最少的客服
    let best = null;
    let minLoad = 999;
    for (const a of admins.data) {
      const cnt = await db.collection('chatSessions').where({
        _adminOpenid: a._openid, status: 1
      }).count();
      if (cnt.total < minLoad) {
        minLoad = cnt.total;
        best = a;
      }
    }
    if (best && minLoad < 10) {  // 每个客服最多 10 个会话
      await db.collection('chatSessions').doc(s._id).update({
        data: {
          _adminOpenid: best._openid,
          _adminId: best._id,
          adminName: best.nickName,
          status: 1,
          updateTime: Date.now()
        }
      });
      // 发送系统消息
      await db.collection('chatMessages').add({
        data: {
          messageId: `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
          sessionId: s.sessionId,
          _openid: s._openid,
          fromType: 'system',
          fromName: '系统',
          type: 'text',
          content: `已为您接入客服 ${best.nickName},请描述您的问题`,
          status: 2,
          createTime: Date.now()
        }
      });
      assigned++;
    }
  }
  return ok({ assigned });
};
