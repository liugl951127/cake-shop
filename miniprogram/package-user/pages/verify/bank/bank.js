// 银行卡四要素
const { request } = require('../../../../utils/request.js');
const { getUser } = require('../../../../utils/auth.js');

// 简化 BIN 识别
const BANK_BIN = {
  '622202': '工商银行', '622848': '工商银行', '622700': '建设银行',
  '622262': '建设银行', '622588': '招商银行', '622576': '招商银行',
  '622155': '农业银行', '621785': '中国银行', '436718': '招商银行'
};
function luhnCheck(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

Page({
  data: {
    user: {},
    form: { name: '', idCard: '', bankCard: '', phone: '', smsCode: '' },
    bankInfo: {},
    countdown: 0,
    submitting: false
  },
  _timer: null,

  onLoad() {
    const u = getUser();
    this.setData({
      user: u,
      'form.name': u.realName || '',
      'form.idCard': u.idCardMasked || ''
    });
  },

  onUnload() { if (this._timer) clearInterval(this._timer); },

  onK(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
    if (k === 'bankCard') this.detectBank(e.detail.value);
  },

  detectBank(num) {
    if (num.length < 6) {
      this.setData({ bankInfo: {} });
      return;
    }
    const bank = BANK_BIN[num.substr(0, 6)] || '未知';
    const isCredit = num.startsWith('4') || num.startsWith('5');
    this.setData({ bankInfo: { bank, type: isCredit ? 'credit' : 'debit' } });
  },

  async onSendCode() {
    if (this.data.countdown > 0) return;
    if (!/^1\d{10}$/.test(this.data.form.phone)) {
      return wx.showToast({ title: '手机号错误', icon: 'none' });
    }
    try {
      await request('phoneLogin', { action: 'sendCode', phone: this.data.form.phone }, { loading: true, silent: true });
      this.setData({ countdown: 60 });
      this._timer = setInterval(() => {
        const c = this.data.countdown - 1;
        if (c <= 0) {
          clearInterval(this._timer);
          this.setData({ countdown: 0 });
        } else {
          this.setData({ countdown: c });
        }
      }, 1000);
      wx.showToast({ title: '已发送' });
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  onSubmit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.name) return wx.showToast({ title: '请填姓名', icon: 'none' });
    if (!f.idCard) return wx.showToast({ title: '请填身份证', icon: 'none' });
    if (!/^\d{16,19}$/.test(f.bankCard) || !luhnCheck(f.bankCard)) {
      return wx.showToast({ title: '银行卡号错误', icon: 'none' });
    }
    if (!/^1\d{10}$/.test(f.phone)) return wx.showToast({ title: '手机号错误', icon: 'none' });
    if (!/^\d{6}$/.test(f.smsCode)) return wx.showToast({ title: '请填验证码', icon: 'none' });

    this.setData({ submitting: true });
    wx.showLoading({ title: '认证中' });
    request('bankCardVerify', f).then((r) => {
      wx.hideLoading();
      wx.showModal({
        title: '认证成功',
        content: `${r.bank} ${r.masked}`,
        showCancel: false,
        success: () => wx.navigateBack()
      });
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: err.msg || '认证失败', icon: 'none' });
    });
  }
});
