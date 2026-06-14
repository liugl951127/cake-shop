// autoCheckChatHealth - 巡检测活(每 30 秒跑一次)
// Cron: */30 * * * * *
// 规则:
//  - 心跳超过 45s 未更新 -> 标记 offline
//  - 双方都 offline 超过 5 分钟 -> 自动结束会话
//  - 用户 offline 但客服在线 -> 写入系统消息提示
//  - 客服 offline 但用户在线 -> 找下一个在线客服接管
const { cloud, ok } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

const USER_TIMEOUT = 45 * 1000;       // 45s 无心跳 = 离线
const ADMIN_TIMEOUT = 60 * 1000;     // 客服 60s(网络更稳定,稍宽松)
const BOTH_OFFLINE_END = 5 * 60 * 1000;  // 双方都离线 5 分钟自动结束
const ADMIN_OFFLINE_TRANSFER = 2 * 60 * 1000;  // 客服离线 2 分钟自动转接

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  const res = await db.collection('chatSessions')
    .where({ status: 1 })
    .limit(200)
    .get();

  let offlineCount = 0;
  let transferredCount = 0;
  let endedCount = 0;

  for (const s of res.data) {
    const userOffline = (now - (s.userLastHeartbeat || 0)) > USER_TIMEOUT;
    const adminOffline = (now - (s.adminLastHeartbeat || 0)) > ADMIN_TIMEOUT;

    const updateData = {};
    let needUpdate = false;

    // 标记双方实时连接状态
    const wasUserOnline = s.userConnected !== false;
    const wasAdminOnline = s.adminConnected !== false;
    const isUserOnline = !userOffline && s.userClientState !== 'leaving';
    const isAdminOnline = !adminOffline && s.adminClientState !== 'leaving';

    if (s.userConnected !== isUserOnline) {
      updateData.userConnected = isUserOnline;
      needUpdate = true;
      if (wasUserOnline && !isUserOnline) offlineCount++;
    }
    if (s.adminConnected !== isAdminOnline) {
      updateData.adminConnected = isAdminOnline;
      needUpdate = true;
      if (wasAdminOnline && !isAdminOnline) offlineCount++;
    }

    // 用户离线提示
    if (userOffline && wasUserOnline) {
      await pushSystemMessage(db, s, 'user',
        '⚠️ 对方暂时离线,消息将在对方上线后送达');
    }

    // 客服离线超过转接时间 -> 自动转接
    if (adminOffline && (now - (s.adminLastHeartbeat || 0)) > ADMIN_OFFLINE_TRANSFER) {
      // 找新客服
      const newAdmin = await findNewAdmin(db, s);
      if (newAdmin) {
        updateData._adminOpenid = newAdmin._openid;
        updateData._adminId = newAdmin._id;
        updateData.adminName = newAdmin.nickName;
        updateData.adminLastHeartbeat = now;
        updateData.adminConnected = true;
        transferredCount++;
        await pushSystemMessage(db, s, 'user',
          `🔄 客服 ${s.adminName || '原客服'} 暂时离开,已为您转接 ${newAdmin.nickName}`);
        await pushSystemMessage(db, s, 'admin',
          `💼 新会话已分配: ${s.userNickName || '用户'}`, newAdmin._openid);
      }
    }

    // 双方都离线超过结束时间 -> 结束
    const bothOffline = userOffline && adminOffline;
    if (bothOffline) {
      const lastActivity = Math.max(s.userLastHeartbeat || 0, s.adminLastHeartbeat || 0);
      if (now - lastActivity > BOTH_OFFLINE_END) {
        updateData.status = 3;  // 结束
        updateData.closeReason = '双方长时间无活动,自动结束';
        updateData.closeTime = now;
        endedCount++;
      }
    }

    if (needUpdate) {
      updateData.updateTime = now;
      await db.collection('chatSessions').doc(s._id).update({ data: updateData });
    }
  }

  return ok({ checked: res.data.length, offlineCount, transferredCount, endedCount });
};

async function pushSystemMessage(db, session, toRole, content, toOpenid) {
  await db.collection('chatMessages').add({
    data: {
      messageId: `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
      sessionId: session.sessionId,
      _openid: session._openid,
      fromType: 'system',
      fromName: '系统',
      type: 'text',
      content,
      toRole,  // 标记这条系统消息是给哪一端看的
      status: 2,
      createTime: Date.now()
    }
  });
}

async function findNewAdmin(db, currentSession) {
  const admins = await db.collection('users')
    .where({ isAdmin: true, isOnline: true })
    .get();
  if (admins.data.length === 0) return null;

  let best = null;
  let minLoad = 999;
  for (const a of admins.data) {
    if (a._openid === currentSession._adminOpenid) continue;
    const cnt = await db.collection('chatSessions').where({
      _adminOpenid: a._openid, status: 1
    }).count();
    if (cnt.total < minLoad) {
      minLoad = cnt.total;
      best = a;
    }
  }
  return best;
}
