// adminGetSessions - 管理员获取会话列表
const { cloud, ok, auth, requireAdmin } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { status, onlyMine = false } = event;
  const db = cloud.database();
  const _ = db.command;

  const where = {};
  if (onlyMine) where._adminOpenid = event._openid;
  if (status !== undefined) where.status = Number(status);

  const res = await db.collection('chatSessions')
    .where(where)
    .orderBy('lastMessageTime', 'desc')
    .limit(100)
    .get();

  // 关联用户信息
  const openids = [...new Set(res.data.map(s => s._openid).filter(Boolean))];
  let userMap = {};
  if (openids.length) {
    const users = await db.collection('users').where({ _openid: _.in(openids) }).get();
    users.data.forEach(u => { userMap[u._openid] = u; });
  }

  return ok(res.data.map(s => ({
    ...s,
    lastMessageTimeText: formatTime(new Date(s.lastMessageTime), 'MM-DD HH:mm'),
    userNickName: s.userNickName || (userMap[s._openid] && userMap[s._openid].nickName) || '用户',
    userAvatar: s.userAvatar || (userMap[s._openid] && userMap[s._openid].avatarUrl) || ''
  })));
});
