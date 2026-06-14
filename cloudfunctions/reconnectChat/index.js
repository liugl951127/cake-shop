// reconnectChat - 用户/客服重连恢复会话
// 入参: { role: 'user' | 'admin' }
// 行为: 查找该端的活跃会话(可能因为网络断了需要恢复)
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { role } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  let session = null;
  if (role === 'admin') {
    // 客服:找分配给当前客服的活跃会话(可能有断线期间漏掉的消息)
    const res = await db.collection('chatSessions')
      .where({ _adminOpenid: event._openid, status: 1 })
      .orderBy('lastMessageTime', 'desc')
      .limit(50)
      .get();
    session = res.data;
  } else {
    // 用户:找自己最近的活跃/排队会话
    const res = await db.collection('chatSessions')
      .where({ _openid: event._openid, status: _.in([1, 2]) })
      .orderBy('createTime', 'desc')
      .limit(1)
      .get();
    session = res.data[0] || null;
  }

  if (!session) return ok(null);

  // 恢复心跳
  if (Array.isArray(session)) {
    // 客服端批量恢复
    for (const s of session) {
      await db.collection('chatSessions').doc(s._id).update({
        data: {
          adminLastHeartbeat: now,
          adminConnected: true,
          adminClientState: 'online',
          adminLeaveTime: 0,
          updateTime: now
        }
      });
      // 提示用户客服回来了
      if (!s.adminConnected) {
        await db.collection('chatMessages').add({
          data: {
            messageId: `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
            sessionId: s.sessionId,
            _openid: s._openid,
            fromType: 'system', fromName: '系统',
            type: 'text',
            content: '🟢 客服已重新连接',
            toRole: 'user', status: 1, createTime: now
          }
        });
      }
    }
    return ok({ sessions: session });
  }

  // 用户端单会话恢复
  const updateData = role === 'user'
    ? { userLastHeartbeat: now, userConnected: true, userClientState: 'online', userLeaveTime: 0, updateTime: now }
    : { adminLastHeartbeat: now, adminConnected: true, adminClientState: 'online', adminLeaveTime: 0, updateTime: now };

  // 如果之前是 offline,告诉对方
  const wasOnline = role === 'user' ? session.userConnected : session.adminConnected;
  if (wasOnline === false) {
    const peerRole = role === 'user' ? 'admin' : 'user';
    await db.collection('chatMessages').add({
      data: {
        messageId: `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
        sessionId: session.sessionId,
        _openid: session._openid,
        fromType: 'system', fromName: '系统',
        type: 'text',
        content: role === 'user' ? '🟢 用户已重新连接' : '🟢 客服已重新连接',
        toRole: peerRole, status: 1, createTime: now
      }
    });
  }

  await db.collection('chatSessions').doc(session._id).update({ data: updateData });
  return ok(session);
});
