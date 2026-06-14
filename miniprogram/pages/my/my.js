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
  goCoupon() { wx.navigateTo({ url: '/package-user/pages/coupon/center/center' }); },
  goSeckill() { wx.navigateTo({ url: '/package-user/pages/seckill/seckill' }); },
  goGroup() { wx.navigateTo({ url: '/package-promo/pages/group/list/list' }); },
  goStore() { wx.navigateTo({ url: '/package-user/pages/store/list/list' }); },
  goLuckyBag() { wx.navigateTo({ url: '/package-user/pages/luckybag/luckybag' }); },
  goInvite() { wx.navigateTo({ url: '/package-user/pages/invite/invite' }); },
  goService() { wx.navigateTo({ url: '/package-promo/pages/service/market/market' }); },

  goOrderList() { wx.switchTab({ url: '/pages/order/list/list' }); },
  goAddress() { wx.navigateTo({ url: '/package-address/pages/address/list/list' }); },
  goFavor() { wx.navigateTo({ url: '/pages/favor/favor' }); },
  goAdminGoods() { wx.navigateTo({ url: '/package-admin/pages/admin/goods/goods' }); },
  goAdminOrders() { wx.navigateTo({ url: '/package-admin/pages/admin/order/order' }); },
  goChat() { wx.navigateTo({ url: '/pages/chat/session/session' }); },
  goChatAdmin() { wx.navigateTo({ url: '/pages/chat/admin/admin' }); },

  contact() {
    wx.showModal({ title: '客服', content: '工作时间 9:00-21:00\n电话: 400-888-8888\n微信: cake_service', showCancel: false });
  },

  about() {
    wx.showModal({ title: '甜心蛋糕 v2.0', content: '用心做好每一块蛋糕 🍰', showCancel: false });
  },

  goChat() { wx.navigateTo({ url: '/package-chat/pages/chat/session/session' }); },
  goChatAdmin() { wx.navigateTo({ url: '/package-chat/pages/chat/admin/admin' }); },
  goNotice() { wx.navigateTo({ url: '/package-cms/pages/cms/notice/notice' }); },
  goAgreement() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=agreement' }); },
  goPrivacy() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=privacy' }); },
  goFaq() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=faq' }); },
  goAbout() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=about' }); },
  goAdminDashboard() { wx.navigateTo({ url: '/package-admin/pages/admin/dashboard/dashboard' }); },
  goLang() { wx.navigateTo({ url: '/package-user/pages/settings/lang/lang' }); },
  goChatDashboard() { wx.navigateTo({ url: '/package-chat/pages/chat/dashboard/dashboard' }); }
});
