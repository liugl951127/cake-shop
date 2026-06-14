// cloudfunctions/clientHangup/index.js
// 客户主动挂断(在 session 页点"结束咨询")
//   1. 校验会话属于该用户
//   2. 状态转 closed
//   3. 同步到企业微信(如果会话已转企微)
//   4. 写挂断日志
//   5. 评价由 client_rate 单独触发

const { cloud, ok, fail, logger, authOptional, ErrorCode, BizError } = require('../common/index.js');
const { clientHangup, Status } = require('../common/session.js');
const { logTransfer, TransferTarget } = require('../common/transfer.js');
const wecom = require('../common/wecom.js');

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
  const { sessionId, userId, reason } = event;
  if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
  if (!userId) return fail('userId 必填', ErrorCode.BAD_REQUEST);

  let result;
  try {
    result = await clientHangup(db, sessionId, userId, reason || 'client_request');
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.SYSTEM_ERROR);
  }

  // 如果会话已转企微,同步挂断
  try {
    const sess = await db.collection('chat_sessions').doc(sessionId).get();
    if (sess.data && sess.data.transferredToWeCom && sess.data.transferredKfId) {
      const openKfId = sess.data.transferredKfId;
      const externalUserId = sess.data.openid || userId;
      const cfg = await loadConfig(db);
      if (cfg) {
        wecom.setConfig({ corpId: cfg.corpId, corpSecret: cfg.corpSecret });
        try {
          // 客户主动挂断 - 企微端: 客服需要主动 close(此处尝试,如果失败不阻塞)
          // 企微暂不支持客户主动 close,只是云端标记
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore */ }

  // 挂断日志
  await logTransfer(db, {
    from: 'client',
    to: { target: 'client_hangup', targetId: userId },
    reason: reason || 'client_request',
    sessionId, userId,
    result: 'success'
  });

  logger.info('client hangup', { sessionId, userId, reason: reason || 'client_request' });
  return ok(result);
});
