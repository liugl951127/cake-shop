// miniprogram/components/payment-keypad/index.js
// 6 位付款密码自定义键盘
//   - 弹层(全屏 modal)
//   - 6 位圆点
//   - 数字键打乱(每次开都重置)
//   - 防截图/录屏
//   - 密码不入 storage
const { PaymentKeypad, vault } = require('../../utils/secureField.js');
const monitor = require('../../utils/monitor.js');

Component({
  properties: {
    visible: { type: Boolean, value: false },
    userId: { type: String, value: '' },
    businessKey: { type: String, value: 'pay' },
    businessData: { type: Object, value: {} },
    title: { type: String, value: '请输入支付密码' }
  },
  data: {
    dots: ['', '', '', '', '', ''],
    keys: [],
    length: 6,
    error: '',
    submitting: false,
    errCount: 0,
    locked: false,
    lockSeconds: 0,
    _lockTimer: null,
    _pwd: ''             // 内存变量(不入 storage)
  },
  observers: {
    'visible': function (v) {
      if (v) {
        this._open();
      } else {
        this._close();
      }
    }
  },
  methods: {
    _open() {
      // 每次开都重置 + 重排
      this._pwd = '';
      const keys = PaymentKeypad.shuffleKeys();
      const dots = ['', '', '', '', '', ''];
      this.setData({
        keys,
        dots,
        error: '',
        submitting: false,
        errCount: 0,
        locked: false,
        lockSeconds: 0
      });
      if (this.data._lockTimer) {
        clearInterval(this.data._lockTimer);
        this.data._lockTimer = null;
      }
    },
    _close() {
      this._pwd = '';
      this.setData({ dots: ['', '', '', '', '', ''], error: '' });
    },

    onTapKey(e) {
      if (this.data.submitting || this.data.locked) return;
      const k = e.currentTarget.dataset.k;
      if (k === 'del') {
        this._pwd = this._pwd.slice(0, -1);
      } else if (k === 'cancel') {
        this.triggerEvent('cancel');
        return;
      } else {
        if (this._pwd.length >= 6) return;
        this._pwd += String(k);
      }
      // 更新圆点
      const dots = ['', '', '', '', '', ''];
      for (let i = 0; i < this._pwd.length; i++) dots[i] = '•';
      this.setData({ dots, error: '' });
      // 输完自动提交
      if (this._pwd.length === 6) {
        this._submit();
      }
    },

    async _submit() {
      if (this.data.submitting) return;
      this.setData({ submitting: true, error: '' });
      try {
        const r = await PaymentKeypad.verify(
          this.properties.userId,
          this._pwd,
          this.properties.businessKey,
          this.properties.businessData
        );
        // 成功,清空 _pwd
        const pwd = this._pwd;
        this._pwd = '';
        this.setData({ dots: ['', '', '', '', '', ''], submitting: false });
        this.triggerEvent('success', { payToken: r.payToken });
      } catch (e) {
        // 失败,抖动
        this.setData({ error: e.message || '密码错误', submitting: false, errCount: this.data.errCount + 1 });
        if (e.code === 5433) {  // LOCKED
          this._startLock(90);
        }
        // 清空 + 抖动
        this._pwd = '';
        setTimeout(() => {
          this.setData({ dots: ['', '', '', '', '', ''] });
        }, 200);
        this.triggerEvent('error', { message: e.message, code: e.code });
        if (typeof monitor !== 'undefined') {
          monitor.event('payment_keypad_error', { code: e.code, errCount: this.data.errCount });
        }
      }
    },

    _startLock(seconds) {
      this.setData({ locked: true, lockSeconds: seconds });
      if (this.data._lockTimer) clearInterval(this.data._lockTimer);
      this.data._lockTimer = setInterval(() => {
        const s = this.data.lockSeconds - 1;
        if (s <= 0) {
          clearInterval(this.data._lockTimer);
          this.data._lockTimer = null;
          this.setData({ locked: false, lockSeconds: 0, errCount: 0 });
        } else {
          this.setData({ lockSeconds: s });
        }
      }, 1000);
    },

    // 关闭弹层
    onClose() {
      this._pwd = '';
      this.triggerEvent('cancel');
    },

    // 防止冒泡
    noop() {},

    onShieldTap() {
      // 屏蔽背景点击
    }
  }
});
