// miniprogram/components/secure-field/index.js
// 通用安全输入(身份证/银行卡/邮箱等)
//   - 不入 wx.storage
//   - 提交时调 secureFieldEncrypt 上传
//   - 调完即清

const { SecureField, vault } = require('../../utils/secureField.js');
const monitor = require('../../utils/monitor.js');

Component({
  properties: {
    fieldType: { type: String, value: 'custom' },     // idcard / bankcard / email / phone / custom
    label: { type: String, value: '' },
    placeholder: { type: String, value: '请输入' },
    encryptKey: { type: String, value: 'default' },
    maxLength: { type: Number, value: 30 },
    showToggle: { type: Boolean, value: false },       // 是否显示密码切换
    isPassword: { type: Boolean, value: false },
    value: { type: String, value: '' }
  },
  data: {
    text: '',
    obscure: true,
    valid: false,
    error: '',
    _key: ''
  },
  lifetimes: {
    attached() {
      // 生成内存 key(不存 storage)
      this.data._key = 'sf:' + this.properties.fieldType + ':' + Math.random().toString(36).slice(2);
    },
    detached() {
      vault.delete(this.data._key);
    }
  },
  observers: {
    'value': function (v) {
      this._setText(v || '');
    }
  },
  methods: {
    onInput(e) {
      this._setText(e.detail.value || '');
    },
    _setText(v) {
      let filtered = v;
      // 字段级过滤
      if (this.properties.fieldType === 'idcard') {
        filtered = v.toUpperCase().replace(/[^0-9X]/g, '').slice(0, 18);
      } else if (this.properties.fieldType === 'bankcard') {
        filtered = v.replace(/\D/g, '').slice(0, 19);
      } else if (this.properties.fieldType === 'phone') {
        filtered = v.replace(/\D/g, '').slice(0, 11);
      } else if (this.properties.fieldType === 'email') {
        filtered = v.slice(0, 64);
      }
      // 格式校验
      const { valid, error } = this._validate(filtered);
      this.setData({ text: filtered, valid, error });
      // 存到内存 vault
      vault.set(this.data._key, filtered, 60 * 60 * 1000);
      this.triggerEvent('input', { value: filtered, valid });
    },
    _validate(v) {
      if (!v) return { valid: false, error: '' };
      if (this.properties.fieldType === 'idcard') {
        if (!/^\d{17}[\dXx]$/.test(v)) return { valid: false, error: '身份证格式错' };
        return { valid: true, error: '' };
      }
      if (this.properties.fieldType === 'bankcard') {
        if (!/^\d{16,19}$/.test(v)) return { valid: false, error: '银行卡格式错' };
        return { valid: true, error: '' };
      }
      if (this.properties.fieldType === 'phone') {
        if (!/^1[3-9]\d{9}$/.test(v)) return { valid: false, error: '手机号格式错' };
        return { valid: true, error: '' };
      }
      if (this.properties.fieldType === 'email') {
        if (!/^[\w-]+@[\w-]+\.[\w]+$/.test(v)) return { valid: false, error: '邮箱格式错' };
        return { valid: true, error: '' };
      }
      return { valid: v.length > 0, error: '' };
    },
    toggleObscure() {
      this.setData({ obscure: !this.data.obscure });
    },
    /**
     * 父组件主动调: 加密并获取 cipher
     */
    async encrypt() {
      if (!this.data.valid) {
        return { ok: false, message: this.data.error || '格式错' };
      }
      try {
        const r = await SecureField.encrypt(this.properties.fieldType, this.data.text, this.properties.encryptKey);
        // 上报
        if (typeof monitor !== 'undefined') {
          monitor.event('secure_field_encrypted', { fieldType: this.properties.fieldType });
        }
        return { ok: true, cipher: r.cipher };
      } catch (e) {
        if (typeof monitor !== 'undefined') {
          monitor.error(e, { scene: 'secure_field.encrypt', fieldType: this.properties.fieldType });
        }
        return { ok: false, message: e.message };
      }
    },
    clear() {
      vault.delete(this.data._key);
      this.setData({ text: '', valid: false, error: '' });
    }
  }
});
