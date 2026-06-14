// leaveChat - 用户/客服主动离开(切后台/退出页面/杀进程)
// role: user | admin
// reason: hide(切后台) | unload(退出) | kill(杀进程) | leave(主动结束)
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { role, reason = 'hide', sessionId = '' } = event;
  if (!['user', 'admin'].includes(role)) throw new BizError('role 必填');
  if (!['hide', 'unload', 'kill', 'leave'].includes(reason)) throw new BizError('reason 错误');

  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  // 找当前活跃会话
  let where = { status: 1 };
  if (role === 'user') where._openid = event._openid;
  else where._adminOpenid = event._openid;
  if (sessionId) where.sessionId = sessionId;

  const res = await db.collection('chatSessions').where(where).limit(1).get();
  if (!res.data[0]) return ok();
  const s = res.data[0];

  const updateData = { updateTime: now };
  if (role === 'user') {
    updateData.userLastHeartbeat = now;
    updateData.userClientState = reason;
    updateData.userConnected = false;
    updateData.userLeaveTime = now;
  } else {
    updateData.adminLastHeartbeat = now;
    updateData.adminClientState = reason;
    updateData.adminConnected = false;
    updateData.adminLeaveTime = now;
  }

  // 主动结束 -> 直接关单
  if (reason === 'leave') {
    updateData.status = 3;
    updateData.closeReason = role === 'user' ? '用户离开' : '客服结束';
    updateData.closeTime = now;
  }

  await db.collection('chatSessions').doc(s._id).update({ data: updateData });

  // 给对方发提示
  const peerRole = role === 'user' ? 'admin' : 'user';
  const REASON_MSG = {
    hide: role === 'user' ? '💤 用户暂时离开' : '💤 客服暂时离开',
    unload: role === 'user' ? '👋 用户退出了聊天' : '👋 客服退出了会话',
    kill: role === 'user' ? '❌ 用户已离线' : '❌ 客服已离线',
    leave: role === 'user' ? '🚪 用户结束了会话' : '🚪 客服结束了会话'
  };
  await db.collection('chatMessages').add({
    data: {
      messageId: `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
      sessionId: s.sessionId,
      _openid: s._openid,
      fromType: 'system', fromName: '系统',
      type: 'text',
      content: REASON_MSG[reason],
      toRole: peerRole, status: 1, createTime: now
    }
  });

  return ok();
});
