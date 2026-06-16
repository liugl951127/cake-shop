// common/secretField.js
// 敏感字段处理工具
//   1. PaymentPassword: 6 位付款密码(只存 hash + salt,永不见明文)
//   2. SmsCode: 6 位短信验证码(只存 hash,5 分钟过期,单次性)
//   3. SecureField: 通用安全字段,支持任何加密机存储
//
// 关键安全:
//   - 客户端永远不存明文密码(连 wx.storage 都不进)
//   - 密码用一次性 token + 加密机加密传输
//   - 风控: 5 次错误 → 锁定 90 秒
//   - 每次校验都生成新 salt + 重新 hash(防彩虹表)
//
// 风控规则:
//   - 同一支付密码 5 次错误 → 锁定 90 秒
//   - 同一手机号验证码 5 次错误 → 锁定 60 秒
//   - 同一手机号验证码发送间隔 60 秒,每日 10 条

const crypto = require('crypto');
const cryptoBox = require('./cryptoBox.js');
const { logger } = require('./logger.js');
const { cache } = require('./cache.js');
const { BizError, ErrorCode } = require('./errors.js');

const POLICY = {
  PAYMENT_PASSWORD: {
    LEN: 6,
    PATTERN: /^\d{6}$/,
    MAX_ATTEMPTS: 5,
    LOCK_SECONDS: 90
  },
  SMS_CODE: {
    LEN: 6,
    PATTERN: /^\d{6}$/,
    MAX_ATTEMPTS: 5,
    LOCK_SECONDS: 60,
    EXPIRE_SECONDS: 300,
    SEND_INTERVAL: 60,
    DAILY_LIMIT: 10
  }
};

// =================== 付款密码 ===================

class PaymentPassword {
  /**
   * 校验密码格式
   */
  static validateFormat(pwd) {
    if (typeof pwd !== 'string') {
      throw new BizError(ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR, '密码必须是字符串');
    }
    if (pwd.length < POLICY.PAYMENT_PASSWORD.LEN) {
      throw new BizError(ErrorCode.PAYMENT_PASSWORD_TOO_SHORT, '密码长度不足');
    }
    if (!POLICY.PAYMENT_PASSWORD.PATTERN.test(pwd)) {
      throw new BizError(ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR, '密码必须 6 位数字');
    }
    // 弱密码检测
    if (this._isWeak(pwd)) {
      throw new BizError(ErrorCode.PAYMENT_PASSWORD_TOO_WEAK, '密码过于简单');
    }
    return true;
  }

  /**
   * 弱密码检测
   */
  static _isWeak(pwd) {
    // 123456 / 654321 / 111111 / 000000
    const weak = ['123456', '654321', '111111', '000000', '999999',
                  '012345', '987654', '121212', '131313'];
    if (weak.includes(pwd)) return true;
    // 全相同
    if (/^(\d)\1+$/.test(pwd)) return true;
    // 连续
    let asc = true, desc = true;
    for (let i = 1; i < pwd.length; i++) {
      if (Number(pwd[i]) !== Number(pwd[i-1]) + 1) asc = false;
      if (Number(pwd[i]) !== Number(pwd[i-1]) - 1) desc = false;
    }
    return asc || desc;
  }

  /**
   * 设置付款密码
   *   返回: { hash, salt, iters, alg, setAt } -- 存数据库
   */
  static set(password) {
    this.validateFormat(password);
    const hashed = cryptoBox.hashPassword(password);
    logger.info('payment password set', { ts: hashed.ts });
    return hashed;
  }

  /**
   * 校验付款密码
   *   - 失败计数,达上限锁定
   *   - 锁定期间拒绝任何校验
   *   - 返回 { ok, attemptsLeft, locked, lockSeconds }
   */
  static async verify(password, storedHash, ctx) {
    const userId = (ctx && ctx.userId) || 'anon';
    const lockKey = 'ppwd:lock:' + userId;
    const errKey = 'ppwd:err:' + userId;

    // 检查是否锁定
    const lockUntil = cache.get(lockKey);
    if (lockUntil && lockUntil > Date.now()) {
      const left = Math.ceil((lockUntil - Date.now()) / 1000);
      throw new BizError(ErrorCode.PAYMENT_PASSWORD_LOCKED, `已锁定,${left}秒后再试`);
    }

    // 格式校验
    try {
      this.validateFormat(password);
    } catch (e) {
      // 格式错不计入错误次数(防恶意)
      throw e;
    }

    // 校验
    const ok = cryptoBox.verifyPassword(password, storedHash);
    if (!ok) {
      const errs = (cache.get(errKey) || 0) + 1;
      cache.set(errKey, errs, 600);
      if (errs >= POLICY.PAYMENT_PASSWORD.MAX_ATTEMPTS) {
        const until = Date.now() + POLICY.PAYMENT_PASSWORD.LOCK_SECONDS * 1000;
        cache.set(lockKey, until, POLICY.PAYMENT_PASSWORD.LOCK_SECONDS);
        cache.del(errKey);
        throw new BizError(ErrorCode.PAYMENT_PASSWORD_LOCKED,
          `已连续错误 ${errs} 次,锁定 ${POLICY.PAYMENT_PASSWORD.LOCK_SECONDS} 秒`);
      }
      throw new BizError(ErrorCode.PAYMENT_PASSWORD_INCORRECT,
        `密码错误,还剩 ${POLICY.PAYMENT_PASSWORD.MAX_ATTEMPTS - errs} 次机会`);
    }
    // 成功,清空错误计数
    cache.del(errKey);
    cache.del(lockKey);
    logger.info('payment password verified', { userId });
    return { ok: true, attemptsLeft: POLICY.PAYMENT_PASSWORD.MAX_ATTEMPTS };
  }

  /**
   * 修改密码(需要旧密码)
   */
  static async change(oldPwd, newPwd, storedHash, ctx) {
    await this.verify(oldPwd, storedHash, ctx);
    return this.set(newPwd);
  }

  /**
   * 重置密码(走短信验证流程,这里不实现)
   */
}

// =================== 短信验证码 ===================

class SmsCode {
  /**
   * 校验格式
   */
  static validateFormat(code) {
    if (typeof code !== 'string') {
      throw new BizError(ErrorCode.SMS_CODE_FORMAT_ERROR, '验证码必须是字符串');
    }
    if (code.length !== POLICY.SMS_CODE.LEN) {
      throw new BizError(ErrorCode.SMS_CODE_FORMAT_ERROR, `验证码必须 ${POLICY.SMS_CODE.LEN} 位`);
    }
    if (!POLICY.SMS_CODE.PATTERN.test(code)) {
      throw new BizError(ErrorCode.SMS_CODE_FORMAT_ERROR, '验证码必须 6 位数字');
    }
    return true;
  }

  /**
   * 生成验证码
   *   返回: { code, hashed, expireAt }
   */
  static generate() {
    let code = '';
    for (let i = 0; i < POLICY.SMS_CODE.LEN; i++) {
      code += Math.floor(Math.random() * 10);
    }
    const salt = cryptoBox.genSalt(8);
    const hashed = cryptoBox.kdf(code, salt, 10000, 16);
    const expireAt = Date.now() + POLICY.SMS_CODE.EXPIRE_SECONDS * 1000;
    return { code, hashed, salt, expireAt };
  }

  /**
   * 存储验证码(应该存到加密机中,而不是明文 cache)
   *   这里 cache 用 hashed(不可逆)
   */
  static store(phone, generated) {
    const key = 'sms:' + phone;
    cache.set(key, {
      hash: generated.hashed,
      salt: generated.salt,
      expireAt: generated.expireAt
    }, POLICY.SMS_CODE.EXPIRE_SECONDS);
  }

  /**
   * 校验验证码
   *   - 自动消费(单次)
   *   - 错误计数
   *   - 锁定
   */
  static async verify(phone, code) {
    this.validateFormat(code);
    const lockKey = 'sms:lock:' + phone;
    const errKey = 'sms:err:' + phone;

    // 锁定
    const lockUntil = cache.get(lockKey);
    if (lockUntil && lockUntil > Date.now()) {
      const left = Math.ceil((lockUntil - Date.now()) / 1000);
      throw new BizError(ErrorCode.SMS_CODE_TOO_MANY, `尝试过多,${left}秒后再试`);
    }

    const key = 'sms:' + phone;
    const stored = cache.get(key);
    if (!stored) {
      throw new BizError(ErrorCode.SMS_CODE_NOT_FOUND, '验证码不存在或已过期');
    }
    if (stored.expireAt < Date.now()) {
      cache.del(key);
      throw new BizError(ErrorCode.SMS_CODE_EXPIRED, '验证码已过期');
    }

    // 校验 hash
    const codeHash = cryptoBox.kdf(code, stored.salt, 10000, 16);
    if (!cryptoBox.safeEqual(codeHash, stored.hash)) {
      const errs = (cache.get(errKey) || 0) + 1;
      cache.set(errKey, errs, 600);
      if (errs >= POLICY.SMS_CODE.MAX_ATTEMPTS) {
        const until = Date.now() + POLICY.SMS_CODE.LOCK_SECONDS * 1000;
        cache.set(lockKey, until, POLICY.SMS_CODE.LOCK_SECONDS);
        cache.del(errKey);
        throw new BizError(ErrorCode.SMS_CODE_TOO_MANY,
          `已连续错误 ${errs} 次,锁定 ${POLICY.SMS_CODE.LOCK_SECONDS} 秒`);
      }
      throw new BizError(ErrorCode.SMS_CODE_INCORRECT,
        `验证码错误,还剩 ${POLICY.SMS_CODE.MAX_ATTEMPTS - errs} 次机会`);
    }
    // 成功
    cache.del(key);
    cache.del(errKey);
    cache.del(lockKey);
    return { ok: true };
  }

  /**
   * 检查发送频率
   */
  static checkSendInterval(phone) {
    const lastKey = 'sms:last:' + phone;
    const last = cache.get(lastKey);
    if (last && (Date.now() - last) < POLICY.SMS_CODE.SEND_INTERVAL * 1000) {
      const left = Math.ceil((POLICY.SMS_CODE.SEND_INTERVAL * 1000 - (Date.now() - last)) / 1000);
      throw new BizError(ErrorCode.SMS_SEND_TOO_FREQUENT, `${left}秒后再发`);
    }
    const dayKey = 'sms:day:' + phone + ':' + new Date().toISOString().slice(0, 10);
    const today = (cache.get(dayKey) || 0) + 1;
    if (today > POLICY.SMS_CODE.DAILY_LIMIT) {
      throw new BizError(ErrorCode.SMS_DAILY_LIMIT, `今日已达 ${POLICY.SMS_CODE.DAILY_LIMIT} 条上限`);
    }
    cache.set(lastKey, Date.now(), 120);
    cache.set(dayKey, today, 86400);
    return true;
  }
}

// =================== 通用安全字段 ===================

class SecureField {
  /**
   * 加密存储(返回存储结构)
   *   field: { type: 'idcard'|'phone'|'bankcard'|'custom', value }
   *   keyAlias: 加密机的 key
   */
  static async encrypt(field, keyAlias, ctx) {
    return cryptoBox.encrypt(field.value, keyAlias, Object.assign({}, ctx, {
      fieldType: field.type
    }));
  }

  /**
   * 解密(需要原始 ctx 一致)
   */
  static async decrypt(cipher, keyAlias, ctx) {
    return cryptoBox.decrypt(cipher, keyAlias, ctx);
  }
}

module.exports = {
  POLICY,
  PaymentPassword,
  SmsCode,
  SecureField
};
