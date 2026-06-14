const { request } = require('../../utils/request.js');
const { login } = require('../../utils/auth.js');

Page({
  data: { userInfo: {} },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
    if (userInfo.openid) this.refreshUser();
  },

  async refreshUser() {
    try {
      const info = await login(true);
      this.setData({ userInfo: info });
    } catch (e) {}
  },

  goLogin() {
    if (this.data.userInfo.openid) return;
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goOrderList(e) {
    const status = e && e.currentTarget.dataset.v;
    wx.switchTab({ url: '/pages/order/list/list' });
  },

  goAddress() { wx.navigateTo({ url: '/pages/address/list/list' }); },
  goFavor() { wx.navigateTo({ url: '/pages/favor/favor' }); },
  goAdminGoods() { wx.navigateTo({ url: '/pages/admin/goods/goods' }); },
  goAdminOrders() { wx.navigateTo({ url: '/pages/admin/order/order' }); },
  goAdmin() {
    const url = encodeURIComponent('https://你的管理后台域名/admin');
    wx.navigateTo({ url: `/pages/webview/webview?url=${url}&title=管理后台` });
  },

  contact() {
    wx.showModal({ title: '客服', content: '工作时间 9:00-21:00\n电话: 400-888-8888', showCancel: false });
  },

  about() {
    wx.showModal({
      title: '关于',
      content: '甜心蛋糕 v1.0.0\n用心做好每一块蛋糕',
      showCancel: false
    });
  }
});
