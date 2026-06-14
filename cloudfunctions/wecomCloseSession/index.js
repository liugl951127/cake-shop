// cloudfunctions/wecomCloseSession/index.js
// 企微客服主动挂断会话
//   1. 调企微 close API
//   2. 更新 chat_sessions 状态
//   3. 写系统消息
//   4. 落 transfer_logs(挂断日志)

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const wecom = require('../common/wecom.js');
const { Status, HangupBy, agentHangup } = require('../common/session.js');
const { logTransfer, TransferTarget } = require('../common/transfer.js');

const crypto = require('crypto');
const MASTER_KEY = process.env.WECOM_MASTER_KEY || 'cake-shop-wecom-2024-32bytes!!';

function decryptSecret(enc) {
  if (!enc) return '';
  try {
    const [iv, tag, data] = enc.split(':');
    const key = Buffer.from(MASTER_KEY);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    let s = decipher.update(Buffer.from(data, 'base64'));
    s = Buffer.concat([s, decipher.final()]);
    return s.toString('utf8');
  } catch (e) { return ''; }
}

async function loadConfig(db) {
  const r = await db.collection('wecom_config').limit(1).get();
  if (!r.data || r.data.length === 0) return null;
  const c = r.data[0];
  return {
    corpId: c.corpId,
    corpSecret: decryptSecret(c.corpSecretEnc || '')
  };
}

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const { sessionId, openKfId, externalUserId, servicerUserId, reason } = event;
  if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
  if (!openKfId || !externalUserId) return fail('openKfId/externalUserId 必填', ErrorCode.BAD_REQUEST);

  // 校验会话
  const sessRes = await db.collection('chat_sessions').doc(sessionId).get();
  if (!sessRes.data) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
  const sess = sessRes.data;
  if (sess.status === Status.CLOSED || sess.status === Status.ARCHIVED) {
    return fail('会话已关闭', ErrorCode.SESSION_ALREADY_CLOSED);
  }

  // 调企微 close
  const cfg = await loadConfig(db);
  if (cfg) {
    wecom.setConfig({ corpId: cfg.corpId, corpSecret: cfg.corpSecret });
    try {
      await wecom.closeKfSession(openKfId, externalUserId, servicerUserId || '');
    } catch (e) {
      // 企微挂断失败不阻塞:云端会话也得关(防止僵尸会话)
      logger.warn('wecom close fail (continue local close)', { e: e.message });
    }
  }

  // 云端关闭
  const result = await agentHangup(db, sessionId, servicerUserId || '', reason || 'agent_request');

  // 挂断日志
  await logTransfer(db, {
    from: servicerUserId || 'agent',
    to: { target: 'wecom_hangup', targetId: openKfId },
    reason: reason || 'agent_request',
    sessionId,
    userId: sess.userId,
    openid: sess.openid,
    extra: { openKfId, externalUserId },
    result: 'success'
  });

  logger.info('wecom session closed', { sessionId, openKfId, externalUserId });
  return ok(result);
});
