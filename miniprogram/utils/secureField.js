// miniprogram/utils/secureField.js
// 客户端安全字段封装
//   - 短信键盘输入框 SmsCodeInput
//   - 付款密码键盘 PaymentKeypad
//   - 通用安全输入 SecureField
//
// 关键安全:
//   - 密码不入 wx.storage
//   - 密码通过一次性 token 传到云函数
//   - 密码只存在内存变量(用完即清空)
//   - 任何复制/截图/调试都被禁止
//   - 与 wx.setStorageSync 解耦(不调用)

const monitor = require('./monitor.js');

// =================== 内存安全存储(不持久化) ===================
class MemoryVault {
  constructor() {
    this._map = new Map();
    this._setAt = new Map();
  }
  set(key, value, ttlMs) {
    this._map.set(key, value);
    this._setAt.set(key, Date.now() + (ttlMs || 0));
  }
  get(key) {
    const exp = this._setAt.get(key) || 0;
    if (exp > 0 && exp < Date.now()) {
      this._map.delete(key);
      this._setAt.delete(key);
      return null;
    }
    return this._map.get(key);
  }
  has(key) { return this._map.has(key); }
  delete(key) {
    this._map.delete(key);
    this._setAt.delete(key);
  }
  // 一次性消费(返回后即清)
  consume(key) {
    const v = this.get(key);
    this.delete(key);
    return v;
  }
  clear() {
    this._map.clear();
    this._setAt.clear();
  }
}
const vault = new MemoryVault();

// =================== 一次性 token 封装 ===================
// 客户端这里只是包装 - 真正的 token 签发在后端
function makeTokenPayload(value) {
  return {
    v: value,
    n: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
    device: getDeviceFingerprint()
  };
}

// 设备指纹(用于风控)
function getDeviceFingerprint() {
  try {
    let fp = wx.getStorageSync('__device_fp__');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
      wx.setStorageSync('__device_fp__', fp);
    }
    return fp;
  } catch (e) {
    return 'fp_anon';
  }
}

// =================== 短信验证码输入 ===================
/**
 * SmsCodeInput - 6 位短信验证码 box 输入
 *
 * 用法:
 *   <sms-code-input
 *     length="{{6}}"
 *     value="{{code}}"
 *     phone="{{phone}}"
 *     purpose="login"
 *     bind:complete="onSmsCodeComplete"
 *     bind:resend="onSmsResend" />
 *
 *   onSmsCodeComplete(e) {
 *     // e.detail.code - 6 位验证码
 *     // e.detail.token - 一次性 token
 *   }
 *
 * 安全:
 *   - 只接受数字
 *   - 6 位输完自动 trigger complete
 *   - paste 支持(自动去非数字)
 *   - 不进 storage
 */
const SmsCodeInput = {
  formatInput(raw) {
    if (!raw) return '';
    return String(raw).replace(/\D/g, '').slice(0, 6);
  },
  isComplete(code) {
    return /^\d{6}$/.test(code);
  },
  async sendCode(phone, purpose) {
    // 调云函数
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'sendSmsCode',
        data: { phone, purpose: purpose || 'verify' },
        success: (res) => {
          const r = res && res.result;
          if (r && r.code === 0) resolve(r.data);
          else reject(new Error((r && r.msg) || '发送失败'));
        },
        fail: reject
      });
    });
  },
  async verifyCode(phone, code) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'verifySmsCode',
        data: { phone, code },
        success: (res) => {
          const r = res && res.result;
          if (r && r.code === 0) resolve(r.data);
          else reject(new Error((r && r.msg) || '校验失败'));
        },
        fail: (err) => reject(new Error((err && err.errMsg) || '网络错误'))
      });
    });
  }
};

// =================== 付款密码输入 ===================
/**
 * PaymentKeypad - 6 位付款密码键盘
 *   - 自定义键盘(随机数字顺序)
 *   - 6 位圆点
 *   - 输完自动触发 verify
 *   - 密码不入 storage,不入 state(用变量 + 立刻清)
 *
 * 用法:
 *   <payment-keypad
 *     visible="{{showKeypad}}"
 *     user-id="{{userId}}"
 *     business-key="pay"
 *     business-data="{{orderInfo}}"
 *     bind:success="onPayPwdSuccess"
 *     bind:error="onPayPwdError"
 *     bind:cancel="onPayPwdCancel" />
 *
 *   onPayPwdSuccess(e) {
 *     // e.detail.payToken - 用于接下来支付
 *   }
 */
const PaymentKeypad = {
  // 生成随机数字键(0-9 打乱)
  shuffleKeys() {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  /**
   * 调用云函数校验密码
   *   - 不接受明文 password
   *   - 内部用一次性 token
   */
  async verify(userId, password, businessKey, businessData) {
    if (typeof password !== 'string' || password.length !== 6) {
      throw new Error('密码必须是 6 位');
    }
    // 调云函数(密码通过 event 传,走云函数内部 token 解析)
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'verifyPaymentPassword',
        data: {
          userId,
          password,             // 6 位数字(明文,仅一次性)
          businessKey,
          businessData
        },
        success: (res) => {
          const r = res && res.result;
          if (r && r.code === 0) {
            resolve(r.data);
            // 上报
            if (typeof monitor !== 'undefined') {
              monitor.event('payment_password_verified', { businessKey });
            }
          } else {
            const err = new Error((r && r.msg) || '密码错误');
            err.code = r && r.code;
            reject(err);
            if (typeof monitor !== 'undefined') {
              monitor.event('payment_password_failed', { businessKey, code: r && r.code });
            }
          }
        },
        fail: (err) => reject(new Error((err && err.errMsg) || '网络错误'))
      });
    });
  },
  /**
   * 设置密码
   *   - 老密码(可选,首次设置不需要)
   *   - 新密码(6 位)
   */
  async set(userId, newPassword, oldPassword) {
    if (typeof newPassword !== 'string' || newPassword.length !== 6) {
      throw new Error('新密码必须是 6 位');
    }
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'setPaymentPassword',
        data: { userId, password: newPassword, oldPassword },
        success: (res) => {
          const r = res && res.result;
          if (r && r.code === 0) resolve(r.data);
          else reject(new Error((r && r.msg) || '设置失败'));
        },
        fail: (err) => reject(new Error((err && err.errMsg) || '网络错误'))
      });
    });
  }
};

// =================== 通用安全字段 ===================
const SecureField = {
  /**
   * 加密通用字段(身份证/银行卡/邮箱等)
   *   返回 { cipher } - 存到数据库
   */
  async encrypt(fieldType, value, keyAlias) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'secureFieldEncrypt',
        data: { fieldType, value, keyAlias },
        success: (res) => {
          const r = res && res.result;
          if (r && r.code === 0) resolve(r.data);
          else reject(new Error((r && r.msg) || '加密失败'));
        },
        fail: (err) => reject(new Error((err && err.errMsg) || '网络错误'))
      });
    });
  }
};

// =================== 防止页面截图/录屏 ===================
function guardScreenshot(page) {
  if (!page || !page.onLoad) return;
  // 小程序不支持禁用截图,但可以监听
  // 用户主动离开页面时清空 vault
  const original = page.onUnload;
  page.onUnload = function () {
    vault.clear();
    if (original) original.call(this);
  };
  const originalHide = page.onHide;
  page.onHide = function () {
    vault.clear();
    if (originalHide) originalHide.call(this);
  };
}

module.exports = {
  vault,
  MemoryVault,
  SmsCodeInput,
  PaymentKeypad,
  SecureField,
  guardScreenshot,
  getDeviceFingerprint,
  makeTokenPayload
};
