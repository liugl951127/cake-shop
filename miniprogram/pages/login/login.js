const { login } = require('../../utils/auth.js');

Page({
  onWxLogin() {
    wx.showLoading({ title: '登录中', mask: true });
    login(true)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '登录成功' });
        setTimeout(() => wx.navigateBack(), 600);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '登录失败,请重试', icon: 'none' });
      });
  },

  goAgreement() {
    wx.showModal({
      title: '协议',
      content: '本小程序由用户授权登录后使用,具体协议请参考上线版本',
      showCancel: false
    });
  }
});
