// transferAgent - 坐席转接(支持:转技能组 / 转指定坐席 / 第三方会话)
const { cloud, ok, fail, auth, BizError } = require('../common/index.js');

const TRANSFER_TYPES = {
  SKILL: 'skill',         // 转技能组(系统自动分配)
  AGENT: 'agent',         // 转指定坐席
  TRIAGE: 'triage'        // 转三方协同会话
};

exports.main = auth(async (event) => {
  const {
    sessionId,
    transferType = 'skill',
    targetSkillGroupId = '',
    targetAgentId = '',
    reason = '',
    context = {},
    urgent = false
  } = event;

  if (!sessionId) return fail('sessionId 必填');
  if (!['skill', 'agent', 'triage'].includes(transferType)) return fail('transferType 错误');
  if (transferType === 'skill' && !targetSkillGroupId) return fail('转技能组需指定组');
  if (transferType === 'agent' && !targetAgentId) return fail('转坐席需指定 agentId');

  const db = cloud.database();
  const _ = db.command;

  // 1. 校验会话存在 + 当前坐席是 owner
  const session = await db.collection('chatSessions').doc(sessionId).get();
  if (!session.data) return fail('会话不存在', -404);
  const s = session.data;
  if (s.ownerAgentId !== event._userId) return fail('不是当前会话的负责人', -403);
  if (s.status !== 1) return fail('会话已结束,无法转接');

  // 2. 找目标坐席
  let targetAgent = null;
  if (transferType === 'skill') {
    targetAgent = await pickAgentBySkill(db, targetSkillGroupId, urgent);
    if (!targetAgent) return fail('该技能组暂无可用坐席');
  } else if (transferType === 'agent') {
    const a = await db.collection('agents').doc(targetAgentId).get();
    if (!a.data) return fail('目标坐席不存在');
    if (!a.data.online) return fail('目标坐席离线');
    if (a.data.busy) return fail('目标坐席忙碌中,稍后再试');
    targetAgent = a.data;
  }
  // triage 不需要指定目标,会在第三方坐席接受时确定

  // 3. 构建转接上下文(关键!目标坐席能立刻看到完整背景)
  const transferContext = {
    fromAgentId: event._userId,
    fromAgentName: s.ownerAgentName || '',
    transferTime: Date.now(),
    reason: reason || '业务需要',
    customer: {
      _userId: s._userId,
      openid: s._openid,
      nickName: s.nickName || '',
      avatarUrl: s.avatarUrl || '',
      phone: s.phone || '',
      level: s.level || '普通',
      vip: s.vip || false,
      orderCount: s.orderCount || 0,
      totalSpend: s.totalSpend || 0
    },
    session: {
      sessionId: s._id,
      sessionNo: s.sessionNo || '',
      startTime: s.createTime,
      duration: Date.now() - s.createTime,
      messageCount: s.messageCount || 0,
      lastMessages: (s.lastMessages || []).slice(-10)
    },
    custom: context,  // 坐席自定义备注
    urgent: !!urgent
  };

  // 4. 写转接记录
  const now = Date.now();
  const transfer = {
    sessionId,
    type: transferType,
    targetSkillGroupId: targetSkillGroupId || '',
    targetSkillGroupName: '',
    targetAgentId: transferType === 'triage' ? '' : targetAgent._id,
    targetAgentName: transferType === 'triage' ? '' : (targetAgent.name || targetAgent.nickName || ''),
    fromAgentId: event._userId,
    fromAgentName: s.ownerAgentName || '',
    reason,
    context: transferContext,
    status: 'pending',  // pending/accepted/rejected/timeout
    urgent: !!urgent,
    createTime: now,
    acceptTime: 0,
    completeTime: 0
  };

  // 拿技能组名称
  if (targetSkillGroupId) {
    const sg = await db.collection('skillGroups').doc(targetSkillGroupId).get().catch(() => null);
    if (sg && sg.data) transfer.targetSkillGroupName = sg.data.name;
  }

  const res = await db.collection('transfers').add({ data: transfer });

  // 5. 更新会话
  const updateData = {
    transferStatus: 1,  // 1-转接中 0-正常
    currentTransferId: res._id,
    updateTime: now
  };
  if (transferType !== 'triage') {
    updateData.nextAgentId = targetAgent._id;
    updateData.nextAgentName = transfer.targetAgentName;
  }
  await db.collection('chatSessions').doc(sessionId).update({ data: updateData });

  // 6. 给目标坐席 / 技能组推送
  await pushTransferNotify(db, transferType === 'triage' ? null : targetAgent, transfer, s);

  // 7. 系统消息插入会话(用户也能看到转接)
  await db.collection('chatMessages').add({
    data: {
      sessionId,
      type: 'system',
      content: `正在为您转接到${transferType === 'skill' ? transfer.targetSkillGroupName : (transfer.targetAgentName || '协办坐席')}${urgent ? '【加急】' : ''}...`,
      fromAgentId: event._userId,
      isSystem: true,
      createTime: now
    }
  });

  return ok({
    transferId: res._id,
    targetAgentId: targetAgent ? targetAgent._id : '',
    targetAgentName: transfer.targetAgentName,
    targetSkillGroupName: transfer.targetSkillGroupName,
    estimatedWait: 30
  });
});

// 智能分配: 同组空闲 + 接待数最少 + 同用户没服务过
async function pickAgentBySkill(db, skillGroupId, urgent = false) {
  const _ = db.command;
  const candidates = await db.collection('agents')
    .where({
      skillGroups: _.elemMatch({ $eq: skillGroupId }),
      online: true,
      acceptStatus: 1,  // 1-接单 0-暂停
      busy: false
    })
    .limit(20)
    .get();

  if (!candidates.data.length) return null;

  // 按"当前会话数"排序,取最少的
  // 加急优先派给 level 高的坐席
  candidates.data.sort((a, b) => {
    if (urgent) {
      if ((b.level || 0) !== (a.level || 0)) return (b.level || 0) - (a.level || 0);
    }
    return (a.currentSessions || 0) - (b.currentSessions || 0);
  });

  return candidates.data[0];
}

async function pushTransferNotify(db, targetAgent, transfer, session) {
  const now = Date.now();
  // 给目标坐席发消息
  if (targetAgent && targetAgent._id) {
    await db.collection('agentMessages').add({
      data: {
        toAgentId: targetAgent._id,
        type: 'transfer_in',
        title: transfer.urgent ? '【加急】' : '' + `来自 ${transfer.fromAgentName} 的转接`,
        content: `${session.nickName || '客户'} - 原因: ${transfer.reason}`,
        data: transfer,
        read: false,
        createTime: now
      }
    });
  }
  // 技能组广播
  if (transfer.targetSkillGroupId) {
    await db.collection('agentMessages').add({
      data: {
        toGroupId: transfer.targetSkillGroupId,
        type: 'transfer_broadcast',
        title: `【组内】新转接需求`,
        content: `客户 ${session.nickName || ''} 等待接单`,
        data: transfer,
        read: false,
        createTime: now
      }
    });
  }
}
