// chatHeartbeat - 心跳上报
// 入参: { sessionId, role: 'user' | 'admin', clientState: 'online' | 'background' | 'leaving' }
// 作用: 更新会话某端最后心跳时间 + 客户端状态
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { sessionId, role, clientState = 'online' } = event;
  if (!sessionId) throw new BizError('sessionId 必填');
  if (!['user', 'admin'].includes(role)) throw new BizError('role 必填');
  if (!['online', 'background', 'leaving'].includes(clientState)) throw new BizError('clientState 错误');

  const db = cloud.database();
  const session = await db.collection('chatSessions').where({ sessionId }).limit(1).get();
  if (!session.data[0]) return ok();
  const s = session.data[0];

  // 权限:用户端只能更新自己的,客服端只能更新分配给自己的
  if (role === 'user' && s._openid !== event._openid) return ok();
  if (role === 'admin' && s._adminOpenid !== event._openid) return ok();

  const now = Date.now();
  const updateData = {};
  if (role === 'user') {
    updateData.userLastHeartbeat = now;
    updateData.userClientState = clientState;
  } else {
    updateData.adminLastHeartbeat = now;
    updateData.adminClientState = clientState;
  }
  updateData.updateTime = now;

  // 离开时: 如果不是已结束,记录离开时间
  if (clientState === 'leaving' || clientState === 'background') {
    if (role === 'user') updateData.userLeaveTime = now;
    else updateData.adminLeaveTime = now;
  } else if (clientState === 'online') {
    if (role === 'user') updateData.userLeaveTime = 0;
    else updateData.adminLeaveTime = 0;
  }

  await db.collection('chatSessions').doc(s._id).update({ data: updateData });
  return ok();
});
