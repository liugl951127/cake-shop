// cloudfunctions/listWeComKf/index.js
// 拉取企业微信客服账号列表(后台手动同步)

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
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

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  if (event.adminBypass !== true) {
    return fail('仅供管理后台', ErrorCode.PERMISSION_DENIED);
  }
  const r = await db.collection('wecom_config').limit(1).get();
  if (!r.data || r.data.length === 0) {
    return fail('企业微信未配置', ErrorCode.WECOM_CONFIG_MISSING);
  }
  const cfg = r.data[0];
  const corpSecret = decryptSecret(cfg.corpSecretEnc || '');
  if (!corpSecret) return fail('corpSecret 未配置', ErrorCode.WECOM_CONFIG_MISSING);

  wecom.setConfig({ corpId: cfg.corpId, corpSecret });
  try {
    const list = await wecom.listKfAccount();
    // 同步到数据库
    const doc = Object.assign({}, cfg, {
      kfAccounts: list,
      kfSyncedAt: Date.now()
    });
    await db.collection('wecom_config').doc(cfg._id).update({
      data: { kfAccounts: list, kfSyncedAt: Date.now() }
    });
    return ok({ list, count: list.length });
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.WECOM_API_ERROR);
  }
});
