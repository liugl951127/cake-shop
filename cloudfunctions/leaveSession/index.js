// leaveSession - 第三方坐席退出 / 主坐席转交
const { cloud, ok, fail, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { sessionId, action = 'leave', newOwnerId = '' } = event;
  if (!sessionId) return fail('sessionId 必填');

  const db = cloud.database();
  const _ = db.command;

  const session = await db.collection('chatSessions').doc(sessionId).get();
  if (!session.data) return fail('会话不存在', -404);
  const s = session.data;
  const now = Date.now();

  if (action === 'leave') {
    // 自己是参与者(非 owner),从 participants 移除
    if (s.ownerAgentId === event._userId) {
      return fail('主坐席不能直接离开,需用 transfer 或 handoff');
    }
    await db.collection('chatSessions').doc(sessionId).update({
      data: {
        participants: _.pull({ agentId: event._userId }),
        updateTime: now
      }
    });
    await db.collection('chatMessages').add({
      data: {
        sessionId,
        type: 'system',
        content: `${event._userName || '协办坐席'} 退出了会话`,
        isSystem: true,
        createTime: now
      }
    });
    return ok({ left: true });
  }

  if (action === 'handoff') {
    // owner 主动转让
    if (s.ownerAgentId !== event._userId) return fail('只有主坐席能转让', -403);
    if (!newOwnerId) return fail('newOwnerId 必填');
    const newOwner = await db.collection('agents').doc(newOwnerId).get();
    if (!newOwner.data) return fail('目标坐席不存在', -404);
    await db.collection('chatSessions').doc(sessionId).update({
      data: {
        ownerAgentId: newOwnerId,
        ownerAgentName: newOwner.data.nickName || '',
        updateTime: now
      }
    });
    await db.collection('chatMessages').add({
      data: {
        sessionId,
        type: 'system',
        content: `会话已转交给 ${newOwner.data.nickName || '新坐席'}`,
        isSystem: true,
        createTime: now
      }
    });
    return ok({ handedOff: true, newOwnerId });
  }
});
