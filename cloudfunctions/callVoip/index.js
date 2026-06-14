// callVoip - 发起 VoIP 通话
// 真实场景:用小程序 VoIP 插件或云开发 callContainer
// 这里实现为:写入消息记录 + 给对方发送推送(订阅消息触发拉起)
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { sessionId, type = 'voice' } = event;  // voice/video
  if (!['voice', 'video'].includes(type)) throw new BizError('type 错误');
  if (!sessionId) throw new BizError('sessionId 必填');

  const db = cloud.database();
  const session = await db.collection('chatSessions').where({ sessionId }).limit(1).get();
  if (!session.data[0]) throw new BizError('会话不存在');
  const s = session.data[0];
  if (s._openid !== event._openid && !event._isAdmin) {
    throw new BizError('无权操作');
  }
  if (s.status === 3) throw new BizError('会话已结束');

  const now = Date.now();
  const callId = `C${now}${Math.floor(Math.random() * 1000)}`;
  const fromType = event._isAdmin ? 'admin' : 'user';
  const peerType = fromType === 'admin' ? 'user' : 'admin';

  // 写入一条系统消息
  const msgRes = await db.collection('chatMessages').add({
    data: {
      messageId: `M${now}${Math.floor(Math.random() * 1000)}`,
      sessionId,
      _openid: s._openid,
      fromType: 'system', fromName: '系统',
      type: 'call',
      content: type === 'voice' ? '📞 语音通话' : '📹 视频通话',
      payload: {
        callId,
        callType: type,
        callStatus: 'inviting',  // inviting/connected/ended/rejected
        fromType,
        fromName: event._isAdmin ? (event._adminName || '客服') : '',
        initiatorOpenid: event._openid,
        startTime: now
      },
      toRole: peerType, status: 1,
      createTime: now
    }
  });

  return ok({ callId, messageId: msgRes._id });
});
