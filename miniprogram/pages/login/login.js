// 登录页 - 微信 + 手机号 + Apple 三种登录方式
const { login: doLogin, appleLogin, phoneSendCode, phoneLogin, logout } = require('../../utils/auth.js');

const LOGIN_TYPE_TEXT = { wechat: '微信', phone: '手机号', apple: 'Apple' };

Page({
  data: {
    userInfo: {},
    loginTypeText: '',
    phonePanel: false,
    phone: '',
    code: '',
    countdown: 0,
    showApple: false
  },

  _timer: null,

  onShow() {
    const u = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo: u,
      loginTypeText: LOGIN_TYPE_TEXT[u.loginType] || ''
    });
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  // 检测是否支持 Apple 登录(iOS 设备)
  checkAppleSupport() {
    try {
      const sys = wx.getSystemInfoSync();
      this.setData({ showApple: sys.system && /iOS/i.test(sys.system) });
    } catch (e) {}
  },

  // 微信登录
  onWxLogin() {
    wx.showLoading({ title: '登录中', mask: true });
    doLogin(true)
      .then((user) => {
        wx.hideLoading();
        this.setData({ userInfo: user, loginTypeText: LOGIN_TYPE_TEXT[user.loginType || 'wechat'] });
        wx.showToast({ title: '登录成功' });
        setTimeout(() => this.goBack(), 600);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '登录失败', icon: 'none' });
      });
  },

  // Apple 登录(仅 iOS 显示)
  onAppleLogin() {
    // 必须用 button open-type="apple",wx 端暂未直接 JS 调起
    // 这里触发隐藏 button 的 tap
    const btn = this.selectComponent('#apple-btn');
    if (btn) btn.tap();
  },

  // Apple 授权回调
  onAppleAuthorized(e) {
    appleLogin(e.detail)
      .then((user) => {
        this.setData({ userInfo: user, loginTypeText: 'Apple' });
        wx.showToast({ title: '登录成功' });
        setTimeout(() => this.goBack(), 600);
      })
      .catch((err) => {
        wx.showToast({ title: err.msg || 'Apple 登录失败', icon: 'none' });
      });
  },

  // 手机号登录
  togglePhone() {
    this.setData({ phonePanel: !this.data.phonePanel });
    this.checkAppleSupport();
  },

  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onCodeInput(e) { this.setData({ code: e.detail.value }); },

  onSendCode() {
    if (this.data.countdown > 0) return;
    if (!/^1\d{10}$/.test(this.data.phone)) {
      return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    }
    wx.showLoading({ title: '发送中' });
    phoneSendCode(this.data.phone)
      .then((r) => {
        wx.hideLoading();
        // 演示模式: 自动填入验证码
        if (r.demoCode) {
          this.setData({ code: r.demoCode });
          wx.showToast({ title: `演示验证码:${r.demoCode}`, icon: 'none' });
        } else {
          wx.showToast({ title: '已发送' });
        }
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
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.msg || '发送失败', icon: 'none' });
      });
  },

  onPhoneLogin() {
    if (!/^1\d{10}$/.test(this.data.phone)) {
      return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    }
    if (!/^\d{6}$/.test(this.data.code)) {
      return wx.showToast({ title: '请输入 6 位验证码', icon: 'none' });
    }
    wx.showLoading({ title: '登录中', mask: true });
    phoneLogin(this.data.phone, this.data.code)
      .then((user) => {
        wx.hideLoading();
        this.setData({ userInfo: user, phonePanel: false, loginTypeText: '手机号' });
        wx.showToast({ title: '登录成功' });
        setTimeout(() => this.goBack(), 600);
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.msg || '登录失败', icon: 'none' });
      });
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  },

  onLogout() {
    wx.showModal({
      title: '提示', content: '确认退出登录?',
      success: (r) => {
        if (r.confirm) {
          logout();
          this.setData({ userInfo: {} });
          wx.showToast({ title: '已退出' });
        }
      }
    });
  },

  goAgreement() {
    wx.showModal({ title: '协议', content: '请参考小程序上线版本中的完整协议', showCancel: false });
  }
});
