const { login: doLogin, logout } = require('../../utils/auth.js');

Page({
  data: { userInfo: {} },

  onShow() {
    this.setData({ userInfo: wx.getStorageSync('userInfo') || {} });
  },

  // 微信一键登录(用户点击按钮时)
  onWxLogin() {
    wx.showLoading({ title: '登录中', mask: true });
    doLogin(true)
      .then((user) => {
        this.setData({ userInfo: user });
        wx.hideLoading();
        wx.showToast({ title: '登录成功' });
        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) wx.navigateBack();
          else wx.switchTab({ url: '/pages/index/index' });
        }, 600);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '登录失败,请重试', icon: 'none' });
      });
  },

  // 已登录态 - 返回
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确认退出登录?',
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
