const { request } = require('../../utils/request.js');
const { login } = require('../../utils/auth.js');

Page({
  data: {
    userInfo: {},
    memberInfo: {},
    couponCount: 0,
    favorCount: 0
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
    if (userInfo.openid) this.refreshAll();
  },

  async refreshAll() {
    try {
      const [member, coupons, favs] = await Promise.all([
        request('getMemberInfo', {}, { loading: false, silent: true }),
        request('getCoupons', { status: 0 }, { loading: false, silent: true }),
        request('getFavorites', {}, { loading: false, silent: true })
      ]);
      this.setData({
        memberInfo: member,
        couponCount: coupons.length,
        favorCount: favs.length
      });
    } catch (e) {}
  },

  goLogin() {
    if (this.data.userInfo.openid) return;
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goMember() { wx.navigateTo({ url: '/pages/member/member' }); },
  goCoupon() { wx.navigateTo({ url: '/pages/coupon/center/center' }); },
  goSeckill() { wx.navigateTo({ url: '/pages/seckill/seckill' }); },
  goGroup() { wx.navigateTo({ url: '/pages/group/list/list' }); },
  goStore() { wx.navigateTo({ url: '/pages/store/list/list' }); },

  goOrderList() { wx.switchTab({ url: '/pages/order/list/list' }); },
  goAddress() { wx.navigateTo({ url: '/pages/address/list/list' }); },
  goFavor() { wx.navigateTo({ url: '/pages/favor/favor' }); },
  goAdminGoods() { wx.navigateTo({ url: '/pages/admin/goods/goods' }); },
  goAdminOrders() { wx.navigateTo({ url: '/pages/admin/order/order' }); },

  contact() {
    wx.showModal({ title: '客服', content: '工作时间 9:00-21:00\n电话: 400-888-8888\n微信: cake_service', showCancel: false });
  },

  about() {
    wx.showModal({ title: '甜心蛋糕 v2.0', content: '用心做好每一块蛋糕 🍰', showCancel: false });
  }
});
