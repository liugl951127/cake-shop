// common/wecom.js
// 企业微信客服 SDK 封装(基于 Node.js crypto,云函数环境可用)
//
// 关键能力:
//   1. access_token 获取 + 缓存(2h 提前 5min 刷新)
//   2. 回调 URL 签名校验(msg_signature 校验)
//   3. 消息加解密(AES-256-CBC + PKCS#7)
//   4. 客服账号管理(kfaccount_list / add / del)
//   5. 客户消息发送 / 接收
//   6. 客服链接生成(给小程序用)
//
// API 文档:
//   https://developer.work.weixin.qq.com/document/path/94677

const crypto = require('crypto');
const https = require('https');
const { cache } = require('./cache.js');
const { logger } = require('./logger.js');
const { ErrorCode, BizError } = require('./errors.js');

const WECOM_API = 'https://qyapi.weixin.qq.com';
const TOKEN_TTL = 7000;  // 7s,access_token 7200s 提前刷新
const AES_BLOCK = 32;

// ============== 配置 ==============
// 真实生产: 读数据库 / 缓存
// 简化: 内存(由调用方通过 setConfig 注入)
let _config = null;
function setConfig(cfg) {
  _config = cfg || null;
  // 清掉 token cache,让下次重新取
  cache.del('wecom:access_token');
}
function getConfig() {
  if (!_config) {
    throw new BizError(ErrorCode.WECOM_CONFIG_MISSING, '未配置企业微信参数');
  }
  return _config;
}

function assertConfig(keys = []) {
  const c = getConfig();
  for (const k of keys) {
    if (!c[k]) throw new BizError(ErrorCode.WECOM_CONFIG_MISSING, `缺少配置: ${k}`);
  }
  return c;
}

// ============== HTTP 调用 ==============
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(new Error('invalid json: ' + body));
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============== access_token ==============
async function getAccessToken(force = false) {
  if (!force) {
    const cached = cache.get('wecom:access_token');
    if (cached && cached.token) return cached.token;
  }
  const cfg = assertConfig(['corpId', 'corpSecret']);
  const url = `${WECOM_API}/cgi-bin/gettoken?corpid=${encodeURIComponent(cfg.corpId)}&corpsecret=${encodeURIComponent(cfg.corpSecret)}`;
  const res = await request(url);
  if (res.errcode !== 0) {
    logger.error('wecom gettoken fail', { errcode: res.errcode, errmsg: res.errmsg });
    throw new BizError(ErrorCode.WECOM_TOKEN_FETCH_FAIL, res.errmsg || 'token 获取失败');
  }
  cache.set('wecom:access_token', { token: res.access_token }, TOKEN_TTL);
  return res.access_token;
}

// ============== 回调签名校验 ==============
function checkSignature(token, timestamp, nonce, msgSignature, encrypt) {
  // 1) msg_signature == sha1(sort([token, timestamp, nonce, encrypt]).join(''))
  const arr = [token, timestamp, nonce, encrypt].sort();
  const hash = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  if (hash !== msgSignature) return false;
  return true;
}

// ============== AES 加解密 ==============
function pkcs7Pad(data) {
  const len = AES_BLOCK - (data.length % AES_BLOCK);
  return Buffer.concat([data, Buffer.alloc(len, len)]);
}
function pkcs7Unpad(data) {
  const pad = data[data.length - 1];
  return data.slice(0, data.length - pad);
}
function aesEncrypt(plaintext, key) {
  // key 32 字节(AESKey 来自 corpId)
  const iv = key.slice(0, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(pkcs7Pad(plaintext)), cipher.final()]);
}
function aesDecrypt(ciphertext, key) {
  const iv = key.slice(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return pkcs7Unpad(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
}

// 企业微信 AESKey 是 43 字符的 base64, 解码后取 32 字节
function decodeAesKey(aesKeyBase64) {
  return Buffer.from(aesKeyBase64 + '=', 'base64');
}

function decryptMessage(encryptBase64, aesKey) {
  try {
    const key = decodeAesKey(aesKey);
    const encrypted = Buffer.from(encryptBase64, 'base64');
    const decrypted = aesDecrypt(encrypted, key);
    // 16 字节随机串 + 4 字节 msg_len + msg + corpId
    const content = decrypted.slice(16);
    const msgLen = content.readUInt32BE(0);
    const msg = content.slice(4, 4 + msgLen).toString('utf8');
    const receiveId = content.slice(4 + msgLen).toString('utf8');
    return { msg, receiveId };
  } catch (e) {
    logger.error('wecom decrypt fail', { e: e.message });
    throw new BizError(ErrorCode.WECOM_DECRYPT_FAIL, e.message);
  }
}

function encryptMessage(replyMsg, aesKey, corpId) {
  // 16 字节随机 + 4 字节 msg_len + msg + receiveId
  const key = decodeAesKey(aesKey);
  const msgBuf = Buffer.from(replyMsg, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(msgBuf.length, 0);
  const rand = crypto.randomBytes(16);
  const corpBuf = Buffer.from(corpId, 'utf8');
  const plaintext = Buffer.concat([rand, lenBuf, msgBuf, corpBuf]);
  const encrypted = aesEncrypt(plaintext, key);
  return encrypted.toString('base64');
}

function makeSignature(token, timestamp, nonce, encrypt) {
  const arr = [token, timestamp, nonce, encrypt].sort();
  return crypto.createHash('sha1').update(arr.join('')).digest('hex');
}

// ============== 客服账号 ==============
async function listKfAccount() {
  const token = await getAccessToken();
  const res = await request(`${WECOM_API}/cgi-bin/kf/account/list?access_token=${token}`);
  if (res.errcode !== 0) throw new BizError(ErrorCode.WECOM_API_ERROR, res.errmsg);
  return res.account_list || [];
}

async function addKfAccount(name, mediaId) {
  const token = await getAccessToken();
  const body = JSON.stringify({ name, media_id: mediaId });
  const res = await request(`${WECOM_API}/cgi-bin/kf/account/add?access_token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.errcode !== 0) throw new BizError(ErrorCode.WECOM_API_ERROR, res.errmsg);
  return res;
}

async function delKfAccount(openKfId) {
  const token = await getAccessToken();
  const body = JSON.stringify({ open_kfid: openKfId });
  const res = await request(`${WECOM_API}/cgi-bin/kf/account/del?access_token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.errcode !== 0) throw new BizError(ErrorCode.WECOM_API_ERROR, res.errmsg);
  return res;
}

// ============== 客户消息 ==============
async function sendKfMessage(openKfId, toExternalUserId, msgType, msgBody) {
  const token = await getAccessToken();
  const body = JSON.stringify({
    touser: toExternalUserId,
    open_kfid: openKfId,
    msgtype: msgType,
    [msgType]: msgBody
  });
  const res = await request(`${WECOM_API}/cgi-bin/kf/message/send?access_token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.errcode !== 0) {
    logger.error('wecom send fail', { errcode: res.errcode, errmsg: res.errmsg });
    throw new BizError(ErrorCode.WECOM_MSG_SEND_FAIL, res.errmsg);
  }
  return res;
}

// ============== 客服会话状态 ==============
/**
 * 获取客服会话状态
 *   GET /cgi-bin/kf/session/get
 */
async function getKfSession(openKfId, externalUserId) {
  const token = await getAccessToken();
  const url = `${WECOM_API}/cgi-bin/kf/session/get?access_token=${token}` +
              `&open_kfid=${encodeURIComponent(openKfId)}` +
              `&external_userid=${encodeURIComponent(externalUserId)}`;
  const res = await request(url);
  if (res.errcode !== 0) {
    logger.warn('wecom session get fail', { errcode: res.errcode, errmsg: res.errmsg });
    throw new BizError(ErrorCode.WECOM_API_ERROR, res.errmsg);
  }
  return res;
}

/**
 * 客服关闭会话(主动挂断)
 *   POST /cgi-bin/kf/session/close
 */
async function closeKfSession(openKfId, externalUserId, servicerUserId) {
  const token = await getAccessToken();
  const body = JSON.stringify({
    open_kfid: openKfId,
    external_userid: externalUserId,
    servicer_userid: servicerUserId
  });
  const res = await request(`${WECOM_API}/cgi-bin/kf/session/close?access_token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.errcode !== 0) {
    logger.error('wecom close fail', { errcode: res.errcode, errmsg: res.errmsg });
    throw new BizError(ErrorCode.WECOM_API_ERROR, res.errmsg);
  }
  return res;
}

/**
 * 客服转接会话
 *   POST /cgi-bin/kf/session/transfer
 */
async function transferKfSession(openKfId, externalUserId, fromServicerUserId, toServicerUserId) {
  const token = await getAccessToken();
  const body = JSON.stringify({
    open_kfid: openKfId,
    external_userid: externalUserId,
    servicer_userid: fromServicerUserId,
    new_servicer_userid: toServicerUserId
  });
  const res = await request(`${WECOM_API}/cgi-bin/kf/session/transfer?access_token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.errcode !== 0) {
    logger.error('wecom transfer fail', { errcode: res.errcode, errmsg: res.errmsg });
    throw new BizError(ErrorCode.WECOM_API_ERROR, res.errmsg);
  }
  return res;
}

// ============== 客服链接(小程序用) ==============
/**
 * 生成小程序"联系客服"参数
 *   返回 { kfAccount, sceneParam } -> 小程序 wx.openCustomerServiceChat
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/api/open-api/service-chat/wx.openCustomerServiceChat.html
 */
async function getKfChatLink({ openKfId, externalUserId, nickName = '', avatar = '' }) {
  // 实际生成场景值,小程序用 wx.openCustomerServiceChat 跳转
  const sceneParam = `openKfId=${openKfId}&externalUserId=${externalUserId}&nick=${encodeURIComponent(nickName)}`;
  return {
    corpId: getConfig().corpId,
    openKfId,
    sceneParam,
    externalUserId,
    nickName,
    avatar
  };
}

module.exports = {
  setConfig,
  getConfig,
  assertConfig,
  getAccessToken,
  checkSignature,
  makeSignature,
  decryptMessage,
  encryptMessage,
  listKfAccount,
  addKfAccount,
  delKfAccount,
  sendKfMessage,
  getKfChatLink,
  getKfSession,
  closeKfSession,
  transferKfSession,
  WECOM_API
};
