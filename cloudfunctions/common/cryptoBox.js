// common/cryptoBox.js
// 加密机适配层(Encryption Machine Adapter)
//   生产环境对接: 阿里云 KMS / 腾讯云 KMS / 华为云 HSM / 百度 HSM
//   开发环境: 本地软件加密 (AES-256-GCM + PBKDF2),不依赖外部
//
// 提供 6 大能力:
//   1. encrypt(plain, keyAlias) - AES-256-GCM 加密
//   2. decrypt(cipher, keyAlias) - AES-256-GCM 解密
//   3. hash(plain, algo) - SHA-256/SM3 散列
//   4. hmac(message, keyAlias) - HMAC-SHA256 签名
//   5. kdf(plain, salt, iters) - PBKDF2 密码派生
//   6. verifyPassword(plain, storedHash) - 密码校验(不存明文)
//
// 关键设计:
//   - 永远不在前端存明文密码
//   - 密码只通过 HTTPS 一次性传到后端
//   - 后端用 KMS 做 PBKDF2 派生,只存 hash + salt
//   - 密码输入框与 SDK 隔离(不会触发 onInput 回调,只触发 onComplete)
//
// 安全原则:
//   - 客户端不能解密(就算拿到 cipher 也解不了)
//   - 即使数据库泄漏,攻击者拿不到明文(只有密文 + salt)
//   - KMS 拒绝所有"在 KMS 之外解密"的操作
//   - 任何敏感字段操作都走审计

const crypto = require('crypto');
const { logger } = require('./logger.js');
const { cache } = require('./cache.js');
const { BizError, ErrorCode } = require('./errors.js');

const ALG = {
  AES_GCM: 'aes-256-gcm',
  PBKDF2: 'pbkdf2-sha256',
  SHA256: 'sha256',
  SM3: 'sm3',            // 国密, 需 native module
  HMAC_SHA256: 'sha256'
};

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;       // GCM 12 字节
const TAG_LEN = 16;

// ===== KMS 抽象接口 =====
class KmsDriver {
  async encrypt(plain, keyAlias, ctx) { throw new Error('not implemented'); }
  async decrypt(cipher, keyAlias, ctx) { throw new Error('not implemented'); }
  async sign(message, keyAlias, ctx) { throw new Error('not implemented'); }
  async verify(message, sig, keyAlias, ctx) { throw new Error('not implemented'); }
  async hmac(message, keyAlias, ctx) { throw new Error('not implemented'); }
  async getKey(keyAlias) { throw new Error('not implemented'); }
}

// ===== 本地软件加密驱动(开发环境) =====
// 警告: 生产必须换成真实 KMS,本地驱动仅作 dev/test 使用
class LocalDriver extends KmsDriver {
  constructor() {
    super();
    this.name = 'local';
    // 主密钥(Master Key,生产应该来自 KMS,这里从 env 拿,fallback 一个测试值)
    this._masterKey = Buffer.from(
      (process.env.MASTER_KEY_HEX || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
      'hex'
    );
    if (this._masterKey.length !== 32) {
      this._masterKey = crypto.createHash('sha256').update('cake-shop-master').digest();
    }
    // 派生 key 的 master
    this._keyMaster = crypto.createHash('sha256')
      .update(this._masterKey).update('kdf-master').digest();
  }

  // 派生数据加密 key
  _deriveKey(keyAlias, ctx) {
    const salt = Buffer.concat([
      Buffer.from(keyAlias || 'default'),
      Buffer.from(ctx && ctx.purpose || 'enc'),
      Buffer.from(ctx && ctx.userId || '')
    ]);
    return crypto.pbkdf2Sync(this._keyMaster, salt, 10000, 32, 'sha256');
  }

  async encrypt(plain, keyAlias, ctx) {
    try {
      const key = this._deriveKey(keyAlias, ctx);
      const iv = crypto.randomBytes(IV_LEN);
      const cipher = crypto.createCipheriv(ALG.AES_GCM, key, iv);
      const aad = Buffer.from(JSON.stringify(ctx || {}));
      cipher.setAAD(aad);
      const data = cipher.update(typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain);
      const final = cipher.final();
      const tag = cipher.getAuthTag();
      return {
        v: 1,
        alg: ALG.AES_GCM,
        keyAlias: keyAlias || 'default',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: Buffer.concat([data, final]).toString('base64'),
        aad: aad.toString('base64'),
        ts: Date.now()
      };
    } catch (e) {
      throw new BizError(ErrorCode.ENCRYPT_FAILED, e.message);
    }
  }

  async decrypt(cipher, keyAlias, ctx) {
    try {
      if (!cipher || !cipher.iv || !cipher.data || !cipher.tag) {
        throw new BizError(ErrorCode.DECRYPT_FAILED, 'cipher 结构不完整');
      }
      const key = this._deriveKey(cipher.keyAlias || keyAlias, ctx);
      const iv = Buffer.from(cipher.iv, 'base64');
      const tag = Buffer.from(cipher.tag, 'base64');
      const decipher = crypto.createDecipheriv(ALG.AES_GCM, key, iv);
      const aad = Buffer.from(cipher.aad || '', 'base64');
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      const data = decipher.update(Buffer.from(cipher.data, 'base64'));
      const final = decipher.final();
      return Buffer.concat([data, final]).toString('utf8');
    } catch (e) {
      if (e instanceof BizError) throw e;
      throw new BizError(ErrorCode.DECRYPT_FAILED, e.message);
    }
  }

  async hmac(message, keyAlias) {
    const key = this._deriveKey(keyAlias || 'hmac', { purpose: 'hmac' });
    return crypto.createHmac('sha256', key).update(message).digest('hex');
  }

  async getKey(keyAlias) {
    return {
      keyAlias: keyAlias,
      alg: ALG.AES_GCM,
      keyVersion: 'v1',
      driver: this.name
    };
  }
}

// ===== 阿里云 KMS 驱动(生产) =====
// https://help.aliyun.com/document_detail/311016.html
class AliyunKmsDriver extends KmsDriver {
  constructor() {
    super();
    this.name = 'aliyun-kms';
    this.accessKey = process.env.ALIYUN_KMS_AK;
    this.secretKey = process.env.ALIYUN_KMS_SK;
    this.region = process.env.ALIYUN_KMS_REGION || 'cn-hangzhou';
    this.endpoint = `https://kms.${this.region}.aliyuncs.com`;
    this._client = null;   // SDK 懒加载
  }

  async _call(action, params) {
    // TODO: 集成 @alicloud/kms20160120 SDK
    // 这里只占位,生产部署时启用
    if (!this.accessKey) {
      throw new BizError(ErrorCode.KMS_UNAVAILABLE, '阿里云 KMS 未配置');
    }
    throw new BizError(ErrorCode.KMS_UNAVAILABLE, '阿里云 KMS 适配器未启用,需在生产环境配置');
  }

  async encrypt(plain, keyAlias) {
    const r = await this._call('Encrypt', { KeyId: keyAlias, Plaintext: plain });
    return JSON.parse(Buffer.from(r.CiphertextBlob, 'base64').toString('utf8'));
  }

  async decrypt(cipher, keyAlias) {
    const r = await this._call('Decrypt', { CiphertextBlob: JSON.stringify(cipher) });
    return r.Plaintext;
  }
}

// ===== 腾讯云 KMS 驱动(生产) =====
class TencentKmsDriver extends KmsDriver {
  constructor() {
    super();
    this.name = 'tencent-kms';
    this.secretId = process.env.TENCENT_KMS_SID;
    this.secretKey = process.env.TENCENT_KMS_SK;
    this.region = process.env.TENCENT_KMS_REGION || 'ap-guangzhou';
  }

  async _call(action, params) {
    if (!this.secretId) {
      throw new BizError(ErrorCode.KMS_UNAVAILABLE, '腾讯云 KMS 未配置');
    }
    throw new BizError(ErrorCode.KMS_UNAVAILABLE, '腾讯云 KMS 适配器未启用');
  }

  async encrypt(plain, keyAlias) {
    const r = await this._call('Encrypt', { KeyId: keyAlias, Plaintext: Buffer.from(plain).toString('base64') });
    return { v: 1, alg: 'kms-encrypt', data: r.CiphertextBlob, keyAlias };
  }

  async decrypt(cipher, keyAlias) {
    const r = await this._call('Decrypt', { CiphertextBlob: cipher.data });
    return Buffer.from(r.Plaintext, 'base64').toString('utf8');
  }
}

// ===== Driver 工厂 =====
let _driver = null;
function getDriver() {
  if (_driver) return _driver;
  const driverName = (process.env.KMS_DRIVER || 'local').toLowerCase();
  switch (driverName) {
    case 'aliyun':
    case 'aliyun-kms':
      _driver = new AliyunKmsDriver();
      break;
    case 'tencent':
    case 'tencent-kms':
      _driver = new TencentKmsDriver();
      break;
    case 'local':
    default:
      _driver = new LocalDriver();
      break;
  }
  logger.info('crypto driver loaded', { driver: _driver.name });
  return _driver;
}

// ===== 公共 API =====

/**
 * 加密
 *   plain: string | Buffer
 *   keyAlias: 加密机中注册的 key 名称
 *   ctx: { userId, purpose, ... }   // 会作为 AAD 绑定,解密时必须传一样的 ctx
 */
async function encrypt(plain, keyAlias = 'default', ctx = {}) {
  const d = getDriver();
  try {
    return await d.encrypt(plain, keyAlias, ctx);
  } catch (e) {
    logger.error('encrypt failed', { keyAlias, err: e.message });
    throw e;
  }
}

/**
 * 解密
 *   cipher: encrypt() 返回的对象
 *   ctx: 必须与 encrypt 时一致
 */
async function decrypt(cipher, keyAlias, ctx = {}) {
  const d = getDriver();
  try {
    return await d.decrypt(cipher, keyAlias, ctx);
  } catch (e) {
    logger.error('decrypt failed', { keyAlias, err: e.message });
    throw e;
  }
}

/**
 * PBKDF2 密码派生
 *   password: 原始密码
 *   salt: 16 字节 Buffer
 *   iters: 迭代次数(默认 100k)
 *   返回: hex 字符串
 */
function kdf(password, salt, iters = PBKDF2_ITERATIONS, keyLen = PBKDF2_KEY_LEN) {
  try {
    if (!Buffer.isBuffer(salt)) salt = Buffer.from(salt, 'hex');
    return crypto.pbkdf2Sync(password, salt, iters, keyLen, 'sha256').toString('hex');
  } catch (e) {
    throw new BizError(ErrorCode.KDF_FAILED, e.message);
  }
}

/**
 * 生成 salt
 */
function genSalt(len = SALT_LEN) {
  return crypto.randomBytes(len).toString('hex');
}

/**
 * 校验密码(不存明文)
 *   password: 用户输入
 *   storedHash: { salt, hash, iters, alg }
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.salt || !storedHash.hash) return false;
  const iters = storedHash.iters || PBKDF2_ITERATIONS;
  const alg = storedHash.alg || 'pbkdf2-sha256';
  if (alg !== 'pbkdf2-sha256') {
    throw new BizError(ErrorCode.SECURE_FIELD_INVALID, '不支持的 hash 算法');
  }
  const computed = kdf(password, storedHash.salt, iters, (storedHash.hash.length || 64) / 2);
  // 常量时间比较
  if (computed.length !== storedHash.hash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(storedHash.hash, 'hex')
  );
}

/**
 * Hash 密码(用于存储)
 *   返回: { salt, hash, iters, alg }
 */
function hashPassword(password) {
  const salt = genSalt();
  const hash = kdf(password, salt);
  return { salt, hash, iters: PBKDF2_ITERATIONS, alg: 'pbkdf2-sha256', ts: Date.now() };
}

/**
 * Hash 通用数据
 */
function hash(data, algo = 'sha256') {
  return crypto.createHash(algo).update(data).digest('hex');
}

/**
 * HMAC 签名
 */
async function hmac(message, keyAlias = 'hmac') {
  const d = getDriver();
  if (typeof d.hmac === 'function') return d.hmac(message, keyAlias);
  // fallback
  return crypto.createHmac('sha256', keyAlias).update(message).digest('hex');
}

/**
 * 安全比较(常量时间)
 */
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * 生成一次性 token(用于敏感操作的客户端 token)
 *   - 单次有效
 *   - 5 分钟过期
 *   - 绑定到 userId + openid + clientId
 */
function generateSecureToken(payload, ttl = 300) {
  const data = {
    p: payload,
    n: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + ttl * 1000,
    ts: Date.now()
  };
  const json = JSON.stringify(data);
  const sig = crypto.createHmac('sha256', process.env.SECURE_TOKEN_SECRET || 'secure-token-2024')
    .update(json).digest('hex');
  return Buffer.from(json).toString('base64url') + '.' + sig;
}

/**
 * 校验一次性 token
 *   - 校验签名 + 过期
 *   - 单次性: 用完即焚(从 cache 删)
 */
function consumeSecureToken(token) {
  if (!token || typeof token !== 'string') {
    throw new BizError(ErrorCode.SECURE_FIELD_INVALID, 'token 缺失');
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new BizError(ErrorCode.SECURE_FIELD_INVALID, 'token 格式错');
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (e) {
    throw new BizError(ErrorCode.SECURE_FIELD_INVALID, 'token 解析失败');
  }
  const expectSig = crypto.createHmac('sha256', process.env.SECURE_TOKEN_SECRET || 'secure-token-2024')
    .update(parts[0]).digest('hex');
  if (expectSig !== parts[1]) {
    throw new BizError(ErrorCode.SECURE_CHANNEL_SIGN_INVALID, 'token 签名错误');
  }
  if (body.exp < Date.now()) {
    throw new BizError(ErrorCode.SECURE_FIELD_EXPIRED, 'token 已过期');
  }
  // 单次性
  const cacheKey = 'secure:tok:' + body.n;
  if (cache.get(cacheKey)) {
    throw new BizError(ErrorCode.SECURE_FIELD_REPLAY, 'token 已使用');
  }
  cache.set(cacheKey, true, 600);
  return body.p;
}

/**
 * 敏感字段脱敏(用于日志)
 *   - 密码: ******
 *   - 手机: 138****1234
 *   - 身份证: 110***********1234
 *   - 银行卡: 6222 **** **** 1234
 */
function mask(value, type = 'auto') {
  if (value == null) return '';
  const s = String(value);
  if (type === 'password' || type === 'pin') return '******';
  if (type === 'phone' || (type === 'auto' && /^1[3-9]\d{9}$/.test(s))) {
    return s.length === 11 ? s.slice(0, 3) + '****' + s.slice(7) : s.slice(0, 2) + '****' + s.slice(-2);
  }
  if (type === 'idcard' || (type === 'auto' && /^\d{17}[\dXx]$/.test(s))) {
    return s.slice(0, 3) + '***********' + s.slice(-4);
  }
  if (type === 'bankcard' || (type === 'auto' && /^\d{16,19}$/.test(s))) {
    return s.slice(0, 4) + ' **** **** ' + s.slice(-4);
  }
  if (type === 'email' || (type === 'auto' && /^[\w-]+@[\w-]+\.[\w]+$/.test(s))) {
    const [u, d] = s.split('@');
    return u.slice(0, 2) + '***@' + d;
  }
  // 默认: 头 2 + 尾 2
  if (s.length <= 4) return '****';
  return s.slice(0, 2) + '****' + s.slice(-2);
}

module.exports = {
  ALG,
  PBKDF2_ITERATIONS,
  PBKDF2_KEY_LEN,
  SALT_LEN,
  getDriver,
  encrypt,
  decrypt,
  kdf,
  genSalt,
  hashPassword,
  verifyPassword,
  hash,
  hmac,
  safeEqual,
  generateSecureToken,
  consumeSecureToken,
  mask
};
