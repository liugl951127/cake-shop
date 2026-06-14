// common/transfer.js
// 转人工 + 多端桥接
//   - 转给云函数客服(已有 sendChatMessage)
//   - 转给企业微信客服(weCom.openKfId)
//   - 转给手机客服(tel:xxx)
//   - 转给指定客服组(技能组匹配)
//
// 桥接规则:
//   transfer.target = 'agent' | 'weCom' | 'phone' | 'group'
//   transfer.targetId = 具体 ID(openKfId / agentId / phone)

const { logger } = require('./logger.js');
const { cache } = require('./cache.js');
const { extractTenantId } = require('./tenant.js');
const { ErrorCode, BizError } = require('./errors.js');

const TransferTarget = {
  AGENT: 'agent',          // 云函数客服
  WECOM: 'weCom',          // 企业微信客服
  PHONE: 'phone',          // 客服电话
  GROUP: 'group'           // 技能组
};

/**
 * 选择目标 - 按优先级 + 关键词
 *   transferRule: { keyword, target, targetId, priority }
 *   candidates:   [{ target, targetId, status, currentLoad }]
 */
function selectTarget(transferRule, candidates) {
  if (candidates && candidates.length > 0) {
    // 选第一个 status=online 且 load 最低的
    const online = candidates
      .filter(c => c.status === 'online')
      .sort((a, b) => (a.load || 0) - (b.load || 0));
    if (online.length > 0) return online[0];
  }
  // 按规则
  if (transferRule) {
    return { target: transferRule.target, targetId: transferRule.targetId };
  }
  throw new BizError(ErrorCode.TRANSFER_NO_AGENT, '无可用客服');
}

/**
 * 记录转接日志
 *   log: { from, to, reason, sessionId, tenantId, ts }
 */
async function logTransfer(db, log) {
  const doc = {
    fromAgent: log.from || 'system',
    toTarget: log.to && log.to.target,
    toTargetId: log.to && log.to.targetId,
    reason: log.reason || '',
    sessionId: log.sessionId || '',
    userId: log.userId || '',
    openid: log.openid || '',
    tenantId: log.tenantId || 'default',
    extra: log.extra || null,
    result: log.result || 'pending',
    ts: Date.now()
  };
  try {
    const res = await db.collection('transfer_logs').add({ data: doc });
    return { ...doc, _id: res._id };
  } catch (e) {
    logger.error('transfer log fail', { e: e.message });
    return null;
  }
}

/**
 * 桥接给企业微信客服 - 生成小程序可用的跳转参数
 */
function buildWeComBridge(cfg, openKfId, externalUserId, nickName) {
  return {
    corpId: cfg.corpId,
    openKfId,
    sceneParam: `openKfId=${openKfId}&externalUserId=${encodeURIComponent(externalUserId || '')}&nick=${encodeURIComponent(nickName || '')}`,
    miniProgram: {
      appId: cfg.miniAppId || '',   // 企业微信小程序
      path: cfg.miniPath || '/pages/chat/chat',
      extraData: { openKfId, externalUserId }
    }
  };
}

/**
 * 桥接给手机客服
 */
function buildPhoneBridge(phone) {
  return {
    type: 'phone',
    tel: phone,
    smsBody: '客户咨询转接,请尽快回复'
  };
}

/**
 * 桥接给云函数客服
 */
function buildAgentBridge(agentId) {
  return {
    type: 'agent',
    agentId,
    invokeName: 'wsGateway',
    action: 'connect',
    payload: { agentId }
  };
}

/**
 * 桥接通用 - 给前端统一接口
 */
function buildBridge(target, cfg, params) {
  switch (target) {
    case TransferTarget.WECOM:
      return buildWeComBridge(cfg, params.openKfId, params.externalUserId, params.nickName);
    case TransferTarget.PHONE:
      return buildPhoneBridge(params.phone);
    case TransferTarget.AGENT:
      return buildAgentBridge(params.agentId);
    case TransferTarget.GROUP:
      // 技能组: 选该组内最闲的
      return { type: 'group', groupId: params.groupId, rule: 'least_loaded' };
    default:
      throw new BizError(ErrorCode.TRANSFER_NOT_ALLOWED, '不支持的转接目标');
  }
}

module.exports = {
  TransferTarget,
  selectTarget,
  logTransfer,
  buildBridge,
  buildWeComBridge,
  buildPhoneBridge,
  buildAgentBridge
};
