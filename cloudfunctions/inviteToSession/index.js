// inviteToSession - 第三方坐席加入会话(三方会话)
// 场景: 售后坐席处理中,需要财务协助,拉财务一起进会话
// 客户/原坐席/邀请坐席 一起看到消息
const { cloud, ok, fail, auth, BizError } = require('../common/index.js');

const MAX_PARTICIPANTS = 4;  // 1 客户 + 3 坐席(上限,防滥用)

exports.main = auth(async (event) => {
  const { sessionId, invitedAgentId, reason = '', role = 'helper' } = event;
  if (!sessionId) return fail('sessionId 必填');
  if (!invitedAgentId) return fail('invitedAgentId 必填');

  const db = cloud.database();
  const _ = db.command;

  const session = await db.collection('chatSessions').doc(sessionId).get();
  if (!session.data) return fail('会话不存在', -404);
  const s = session.data;

  // 当前坐席必须是 owner / participant
  const participants = s.participants || [];
  const isParticipant = s.ownerAgentId === event._userId || participants.some(p => p.agentId === event._userId);
  if (!isParticipant) return fail('非会话参与方,无法邀请', -403);

  // 受邀坐席存在 + 不可重复
  const invited = await db.collection('agents').doc(invitedAgentId).get();
  if (!invited.data) return fail('受邀坐席不存在', -404);
  if (s.ownerAgentId === invitedAgentId) return fail('已经在会话中');
  if (participants.some(p => p.agentId === invitedAgentId)) return fail('该坐席已加入');

  // 上限校验
  const totalSeats = 1 + participants.length + 1;  // 1=owner
  if (totalSeats > MAX_PARTICIPANTS) {
    return fail(`三方会话最多 ${MAX_PARTICIPANTS} 方(含客户),已达上限`);
  }

  const now = Date.now();
  // 加进 participants
  const newParticipant = {
    agentId: invitedAgentId,
    agentName: invited.data.nickName || invited.data.name || '',
    role,  // helper/observer/expert
    invitedBy: event._userId,
    invitedByName: '',
    joinTime: now
  };
  await db.collection('chatSessions').doc(sessionId).update({
    data: {
      participants: _.push([newParticipant]),
      isMultiParty: true,
      updateTime: now
    }
  });

  // 系统消息
  await db.collection('chatMessages').add({
    data: {
      sessionId,
      type: 'system',
      content: `${invited.data.nickName || '协办坐席'} 加入了会话${reason ? ' · ' + reason : ''}`,
      isSystem: true,
      createTime: now
    }
  });

  // 通知受邀坐席
  await db.collection('agentMessages').add({
    data: {
      toAgentId: invitedAgentId,
      type: 'invite_session',
      title: '会话邀请',
      content: `客户 ${s.nickName || ''} 的会话邀请您加入${reason ? ' · ' + reason : ''}`,
      data: { sessionId, reason, role },
      read: false,
      createTime: now
    }
  });

  return ok({
    sessionId,
    participant: newParticipant,
    totalSeats
  });
});
