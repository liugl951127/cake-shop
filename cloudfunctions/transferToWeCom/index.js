// cloudfunctions/transferToWeCom/index.js
// 客户发起转人工 -> 企业微信客服
//   1. 校验转接资格
//   2. 选客服(技能组匹配 / 关键词匹配 / 兜底)
//   3. 生成小程序可用的跳转参数(openCustomerServiceChat)
//   4. 落 transfer_logs
//   5. 在 chat_sessions 标记"已转企业微信"
//
// 入参: { sessionId, userId, openid, reason, openKfId? }
// 出参: { corpId, openKfId, sceneParam, transferLogId }

const { cloud, ok, fail, logger, authOptional, ErrorCode, BizError } = require('../common/index.js');
const wecom = require('../common/wecom.js');
const { logTransfer, TransferTarget, buildBridge } = require('../common/transfer.js');

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
  } catch (e) {
    return '';
  }
}

async function loadConfig(db) {
  const r = await db.collection('wecom_config').limit(1).get();
  if (!r.data || r.data.length === 0) return null;
  const c = r.data[0];
  return {
    ...c,
    corpSecret: decryptSecret(c.corpSecretEnc || ''),
    token: decryptSecret(c.tokenSecretEnc || ''),
    aesKey: decryptSecret(c.aesKeyEnc || '')
  };
}

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const { sessionId, userId, openid, reason, openKfId, nickName } = event;
  if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
  if (!userId) return fail('userId 必填', ErrorCode.BAD_REQUEST);

  // 1. 加载企业微信配置
  const cfg = await loadConfig(db);
  if (!cfg || !cfg.corpId) {
    return fail('企业微信未配置', ErrorCode.WECOM_CONFIG_MISSING);
  }

  // 2. 选客服账号
  let targetKfId = openKfId;
  let targetKfName = '';
  const kfAccounts = cfg.kfAccounts || [];
  if (!targetKfId) {
    if (kfAccounts.length === 0) {
      return fail('客服账号未配置', ErrorCode.WECOM_KF_ACCOUNT_MISSING);
    }
    // 简单: 取第一个 open_kfid
    targetKfId = kfAccounts[0].open_kfid;
    targetKfName = kfAccounts[0].name || '客服';
  }

  // 3. 选/生成 externalUserId(企业微信的"客户 ID",用用户的 openid 衍生)
  const externalUserId = openid || userId;

  // 4. 生成跳转参数(小程序 wx.openCustomerServiceChat 用)
  const bridge = buildBridge(TransferTarget.WECOM,
    { corpId: cfg.corpId },
    { openKfId: targetKfId, externalUserId, nickName: nickName || '' }
  );

  // 5. 落 transfer_logs
  const tlog = await logTransfer(db, {
    from: 'ai-or-bot',
    to: { target: TransferTarget.WECOM, targetId: targetKfId },
    reason: reason || 'user_request',
    sessionId, userId, openid,
    extra: { nickName, kfName: targetKfName },
    result: 'pending'
  });

  // 6. 标记会话"已转企业微信"
  try {
    await db.collection('chat_sessions').doc(sessionId).update({
      data: {
        transferredToWeCom: true,
        transferredKfId: targetKfId,
        transferredAt: Date.now(),
        transferLogId: tlog && tlog._id
      }
    });
  } catch (e) { /* ignore */ }

  // 7. 发个系统消息到会话,告诉客户已转接
  try {
    await db.collection('chat_messages').add({
      data: {
        sessionId,
        type: 'system',
        from: 'system',
        fromRole: 'system',
        content: `已为您转接人工客服(${targetKfName}),请稍候...`,
        ts: Date.now(),
        created: Date.now()
      }
    });
  } catch (e) { /* ignore */ }

  logger.info('transfer to wecom', { sessionId, userId, openKfId: targetKfId, tlogId: tlog && tlog._id });
  return ok(Object.assign({
    transferLogId: tlog && tlog._id,
    targetKfName
  }, bridge));
});
