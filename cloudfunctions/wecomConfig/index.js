// cloudfunctions/wecomConfig/index.js
// 企业微信配置 - 客户端拉签名 + 客服账号列表
// 鉴权: adminBypass(后台)

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const wecom = require('../common/wecom.js');
const { audit } = require('../common/audit.js');

// 简单加密: AES-256-GCM(避免明文存企业微信 corpSecret)
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
  const doc = r.data[0];
  return {
    ...doc,
    corpSecret: decryptSecret(doc.corpSecretEnc || ''),
    tokenSecret: decryptSecret(doc.tokenSecretEnc || ''),
    aesKey: decryptSecret(doc.aesKeyEnc || '')
  };
}

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const action = event.action;

  if (action === 'signature') {
    // 给客户端用: 返回 wx.config 需要的签名参数
    const cfg = await loadConfig(db);
    if (!cfg) return fail('企业微信未配置', ErrorCode.WECOM_CONFIG_MISSING);
    // 实际签名需 jsapi_ticket,这里给基础信息
    return ok({
      corpId: cfg.corpId,
      agentId: cfg.agentId || '',
      // 客服跳转参数
      kfAccounts: cfg.kfAccounts || []
    });
  }

  if (action === 'listKf') {
    if (event.adminBypass !== true) {
      return fail('仅供管理后台', ErrorCode.PERMISSION_DENIED);
    }
    const cfg = await loadConfig(db);
    if (!cfg) return fail('企业微信未配置', ErrorCode.WECOM_CONFIG_MISSING);
    wecom.setConfig({
      corpId: cfg.corpId,
      corpSecret: cfg.corpSecret
    });
    try {
      const list = await wecom.listKfAccount();
      return ok({ list });
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail(e.message, ErrorCode.WECOM_API_ERROR);
    }
  }

  if (action === 'save') {
    if (event.adminBypass !== true) {
      return fail('仅供管理后台', ErrorCode.PERMISSION_DENIED);
    }
    const doc = {
      corpId: event.corpId || '',
      agentId: event.agentId || '',
      // 入库时加密
      corpSecretEnc: event.corpSecret ? encrypt(event.corpSecret) : '',
      tokenSecretEnc: event.token || encrypt(event.token || ''),
      aesKeyEnc: event.encodingAESKey ? encrypt(event.encodingAESKey) : '',
      kfAccounts: event.kfAccounts || [],
      callbackUrl: event.callbackUrl || '',
      updatedAt: Date.now()
    };
    const exist = await db.collection('wecom_config').limit(1).get();
    if (exist.data && exist.data.length) {
      await db.collection('wecom_config').doc(exist.data[0]._id).update({ data: doc });
    } else {
      await db.collection('wecom_config').add({ data: { ...doc, createdAt: Date.now() } });
    }
    await audit(db, {
      action: 'wecom.config.save',
      targetType: 'wecom',
      targetId: 'global',
      detail: { corpId: doc.corpId, agentId: doc.agentId }
    });
    return ok();
  }

  if (action === 'get') {
    if (event.adminBypass !== true) {
      return fail('仅供管理后台', ErrorCode.PERMISSION_DENIED);
    }
    const cfg = await loadConfig(db);
    if (!cfg) return ok(null);
    return ok({
      corpId: cfg.corpId,
      agentId: cfg.agentId,
      corpSecretMasked: cfg.corpSecret ? '****' + cfg.corpSecret.slice(-4) : '',
      tokenMasked: cfg.tokenSecret ? '****' + cfg.tokenSecret.slice(-4) : '',
      aesKeyMasked: cfg.aesKey ? '****' + cfg.aesKey.slice(-4) : '',
      kfAccounts: cfg.kfAccounts || [],
      callbackUrl: cfg.callbackUrl || '',
      hasCorpSecret: !!cfg.corpSecret
    });
  }

  return fail('未知 action', ErrorCode.BAD_REQUEST);
});

function encrypt(text) {
  if (!text) return '';
  const key = Buffer.from(MASTER_KEY);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let s = cipher.update(text, 'utf8');
  s = Buffer.concat([s, cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('base64') + ':' + tag.toString('base64') + ':' + s.toString('base64');
}
