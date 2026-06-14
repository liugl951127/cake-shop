// respondTransfer - 坐席接受/拒绝转接
const { cloud, ok, fail, auth, BizError } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { transferId, action = 'accept', note = '' } = event;
  if (!transferId) return fail('transferId 必填');
  if (!['accept', 'reject'].includes(action)) return fail('action 错误');

  const db = cloud.database();
  const _ = db.command;

  const transfer = await db.collection('transfers').doc(transferId).get();
  if (!transfer.data) return fail('转接单不存在', -404);
  const t = transfer.data;
  if (t.status !== 'pending') return fail('转接单已处理');

  // 转技能组:任意同组在线可接;转坐席:仅指定坐席可接
  let canAccept = false;
  if (t.type === 'skill') {
    const me = await db.collection('agents').doc(event._userId).get();
    if (me.data && me.data.skillGroups && me.data.skillGroups.includes(t.targetSkillGroupId)) {
      canAccept = true;
    }
  } else {
    canAccept = t.targetAgentId === event._userId;
  }
  if (!canAccept) return fail('无权处理此转接', -403);

  const now = Date.now();
  const session = await db.collection('chatSessions').doc(t.sessionId).get();
  if (!session.data) return fail('会话不存在', -404);
  const s = session.data;

  if (action === 'reject') {
    await db.collection('transfers').doc(transferId).update({
      data: { status: 'rejected', rejectNote: note, completeTime: now }
    });
    // 给原坐席发回执
    await db.collection('agentMessages').add({
      data: {
        toAgentId: t.fromAgentId,
        type: 'transfer_rejected',
        title: '转接被拒绝',
        content: `原因: ${note || '坐席繁忙'}`,
        relatedId: transferId,
        createTime: now
      }
    });
    return ok({ rejected: true });
  }

  // accept
  // 1. 更新转接单
  await db.collection('transfers').doc(transferId).update({
    data: {
      status: 'accepted',
      acceptedBy: event._userId,
      acceptedByName: '',
      acceptTime: now,
      completeTime: now
    }
  });

  // 2. 更新会话:换主
  const me = await db.collection('agents').doc(event._userId).get();
  await db.collection('chatSessions').doc(t.sessionId).update({
    data: {
      ownerAgentId: event._userId,
      ownerAgentName: me.data ? (me.data.name || me.data.nickName || '') : '',
      transferStatus: 0,
      currentTransferId: '',
      nextAgentId: '',
      nextAgentName: '',
      acceptTime: now,
      updateTime: now
    }
  });

  // 3. 加载转接上下文(给目标坐席)
  const context = t.context || {};
  context.acceptedAt = now;
  context.acceptedBy = event._userId;

  // 4. 系统消息通知用户
  await db.collection('chatMessages').add({
    data: {
      sessionId: t.sessionId,
      type: 'system',
      content: `已为您接入 ${me.data ? (me.data.name || me.data.nickName) : '客服'}`,
      isSystem: true,
      createTime: now
    }
  });

  // 5. 给原坐席发回执
  await db.collection('agentMessages').add({
    data: {
      toAgentId: t.fromAgentId,
      type: 'transfer_accepted',
      title: '转接已接受',
      content: `由 ${me.data ? me.data.nickName : ''} 接单`,
      relatedId: transferId,
      createTime: now
    }
  });

  return ok({
    sessionId: t.sessionId,
    context
  });
});
