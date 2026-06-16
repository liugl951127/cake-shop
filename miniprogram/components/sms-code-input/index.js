// miniprogram/components/sms-code-input/index.js
// 6 位短信验证码输入组件
//   - 6 个 box
//   - 只接受数字
//   - 粘贴自动去非数字
//   - 自动 focus
//   - 倒计时
const { SmsCodeInput } = require('../../utils/secureField.js');
const monitor = require('../../utils/monitor.js');

Component({
  properties: {
    length: { type: Number, value: 6 },
    phone: { type: String, value: '' },
    purpose: { type: String, value: 'verify' },
    autoSend: { type: Boolean, value: false },
    countdown: { type: Number, value: 60 },
    value: { type: String, value: '' }
  },
  data: {
    boxes: [],          // ['', '', '', '', '', '']
    current: 0,         // 当前焦点位置
    count: 0,           // 倒计时
    sending: false,
    sent: false,
    error: '',
    errCode: 0
  },
  lifetimes: {
    attached() {
      const len = this.properties.length || 6;
      this.setData({ boxes: new Array(len).fill('') });
      if (this.properties.autoSend) {
        this.sendCode();
      }
    }
  },
  observers: {
    'value': function (v) {
      const len = this.properties.length || 6;
      const v2 = SmsCodeInput.formatInput(v || '');
      const boxes = new Array(len).fill('');
      for (let i = 0; i < Math.min(v2.length, len); i++) boxes[i] = v2[i];
      this.setData({ boxes, current: Math.min(v2.length, len) });
    }
  },
  methods: {
    onInput(e) {
      const val = e.detail.value || '';
      const len = this.properties.length || 6;
      const v = SmsCodeInput.formatInput(val).slice(0, len);
      const boxes = new Array(len).fill('');
      for (let i = 0; i < v.length; i++) boxes[i] = v[i];
      this.setData({ boxes, current: Math.min(v.length, len - 1), error: '' });
      // 输完自动 verify
      if (v.length === len) {
        this._verifyAndComplete(v);
      } else {
        this.triggerEvent('input', { value: v });
      }
    },
    onFocus() {},
    onBlur() {},

    // 粘贴
    onPaste(e) {
      const text = (e.detail && e.detail.data) || wx.getClipboardData ? '' : '';
      // wx 没有 onPaste 事件,使用原生 input 处理
    },

    onTapBox(e) {
      const idx = e.currentTarget.dataset.i;
      this.setData({ current: idx });
    },

    async sendCode() {
      if (this.data.sending || this.data.count > 0) return;
      if (!this.properties.phone) {
        this.setData({ error: '请输入手机号' });
        return;
      }
      this.setData({ sending: true, error: '' });
      try {
        const r = await SmsCodeInput.sendCode(this.properties.phone, this.properties.purpose);
        this.setData({
          sent: true,
          count: this.properties.countdown,
          sending: false
        });
        this.triggerEvent('sent', { expireAt: r.expireAt, maskedPhone: r.maskedPhone });
        this._tick();
        if (typeof monitor !== 'undefined') {
          monitor.event('sms_sent', { purpose: this.properties.purpose });
        }
      } catch (e) {
        this.setData({ sending: false, error: e.message || '发送失败' });
        this.triggerEvent('sendError', { message: e.message });
      }
    },

    _tick() {
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => {
        const c = this.data.count - 1;
        if (c <= 0) {
          clearInterval(this._timer);
          this._timer = null;
          this.setData({ count: 0 });
        } else {
          this.setData({ count: c });
        }
      }, 1000);
    },

    async _verifyAndComplete(code) {
      if (!this.properties.phone) {
        this.setData({ error: '请先输入手机号' });
        return;
      }
      try {
        const r = await SmsCodeInput.verifyCode(this.properties.phone, code);
        this.setData({ error: '' });
        this.triggerEvent('complete', { code, token: r.verifyToken, maskedPhone: r.maskedPhone });
      } catch (e) {
        this.setData({ error: e.message || '校验失败', errCode: e.code || 0 });
        this.triggerEvent('verifyError', { code, message: e.message });
        // 清空重输
        const len = this.properties.length || 6;
        this.setData({ boxes: new Array(len).fill(''), current: 0 });
      }
    },

    // 父组件主动调
    reset() {
      const len = this.properties.length || 6;
      this.setData({ boxes: new Array(len).fill(''), current: 0, error: '' });
    }
  }
});
