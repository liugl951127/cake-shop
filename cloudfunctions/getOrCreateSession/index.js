// getOrCreateSession - 用户进入客服:获取或创建会话
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const _ = db.command;

  // 查用户的当前活跃会话(状态=1 接入中 / 2 排队中)
  const exist = await db.collection('chatSessions')
    .where({
      _openid: event._openid,
      status: _.in([1, 2])
    })
    .orderBy('createTime', 'desc')
    .limit(1)
    .get();

  if (exist.data[0]) {
    return ok(exist.data[0]);
  }

  // 创建新会话(状态 1=接入中,2=排队中)
  // 简单负载:找当前接待数最少的客服
  const admins = await db.collection('users')
    .where({ isAdmin: true, isOnline: true })
    .get().catch(() => ({ data: [] }));

  // 找最闲的客服
  let bestAdmin = null;
  let minLoad = 999;
  for (const a of admins.data) {
    const load = await db.collection('chatSessions')
      .where({ _adminOpenid: a._openid, status: 1 })
      .count().catch(() => ({ total: 0 }));
    if (load.total < minLoad) {
      minLoad = load.total;
      bestAdmin = a;
    }
  }

  const sessionId = `S${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const res = await db.collection('chatSessions').add({
    data: {
      sessionId,
      _openid: event._openid,
      _userId: event._userId,
      _adminOpenid: bestAdmin ? bestAdmin._openid : '',
      _adminId: bestAdmin ? bestAdmin._id : '',
      adminName: bestAdmin ? bestAdmin.nickName : '系统分配',
      status: bestAdmin ? 1 : 2,
      lastMessage: '',
      lastMessageTime: Date.now(),
      unreadByUser: 0,
      unreadByAdmin: 0,
      userNickName: '',
      userAvatar: '',
      // 连接状态字段
      userConnected: true,
      userClientState: 'online',
      userLastHeartbeat: Date.now(),
      userLeaveTime: 0,
      adminConnected: !!bestAdmin,
      adminClientState: bestAdmin ? 'online' : 'leaving',
      adminLastHeartbeat: bestAdmin ? Date.now() : 0,
      adminLeaveTime: bestAdmin ? 0 : Date.now(),
      createTime: Date.now(),
      updateTime: Date.now()
    }
  });

  return ok({
    _id: res._id,
    sessionId,
    status: bestAdmin ? 1 : 2,
    adminName: bestAdmin ? bestAdmin.nickName : '客服',
    waitingPosition: bestAdmin ? 0 : (await db.collection('chatSessions').where({ status: 2 }).count()).total
  });
});
