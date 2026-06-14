// 我的 - 樱花主题
const { request } = require('../../utils/request.js');
const { login } = require('../../utils/auth.js');

const ORDER_TYPES = [
  { id: 'unpaid', name: '待付款', icon: '💳' },
  { id: 'unsent', name: '待发货', icon: '📦' },
  { id: 'unreceived', name: '待收货', icon: '🚚' },
  { id: 'unreviewed', name: '待评价', icon: '✏️' },
  { id: 'aftersale', name: '退款', icon: '↩️' }
];

Page({
  data: {
    userInfo: {},
    memberInfo: {},
    couponCount: 0,
    favorCount: 0,
    orderCount: 0,
    balance: 0,
    version: '2.0',
    orderTypes: ORDER_TYPES
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
    if (userInfo.openid) this.refreshAll();
  },

  async refreshAll() {
    try {
      const [member, coupons, favs, orders] = await Promise.all([
        request('getMemberInfo', {}, { loading: false, silent: true }),
        request('getCoupons', { status: 0 }, { loading: false, silent: true }).catch(() => []),
        request('getFavorites', {}, { loading: false, silent: true }).catch(() => []),
        request('getOrders', { page: 1, pageSize: 5 }, { loading: false, silent: true }).catch(() => ({ list: [] }))
      ]);

      // 计算订单状态数(简化)
      const orderCount = (orders.list || orders || []).length;
      const typeMap = { unpaid: 0, unsent: 0, unreceived: 0, unreviewed: 0, aftersale: 0 };
      for (const o of (orders.list || orders || [])) {
        if (o.status === 0) typeMap.unpaid++;
        else if (o.status === 1) typeMap.unsent++;
        else if (o.status === 2 || o.status === 3) typeMap.unreceived++;
        else if (o.status === 3 && !o.reviewed) typeMap.unreviewed++;
        else if (o.status === -2) typeMap.aftersale++;
      }
      const orderTypes = ORDER_TYPES.map(t => ({ ...t, badge: typeMap[t.id] || '' }));

      this.setData({
        memberInfo: member,
        couponCount: (coupons || []).length,
        favorCount: (favs || []).length,
        orderCount,
        balance: (userInfo.totalSpend || 0).toFixed(2),
        orderTypes
      });
    } catch (e) {}
  },

  // ===== 跳转 =====
  goLogin() {
    if (this.data.userInfo.openid) return;
    wx.navigateTo({ url: '/pages/login/login' });
  },
  goWallet() { wx.navigateTo({ url: '/package-user/pages/finance/center/center' }); },
  goCoupon() { wx.navigateTo({ url: '/package-user/pages/coupon/center/center' }); },
  goBalance() { wx.navigateTo({ url: '/package-user/pages/finance/center/center' }); },
  goOrder() { wx.navigateTo({ url: '/package-order/pages/order/list/list' }); },
  goOrderList() { wx.navigateTo({ url: '/package-order/pages/order/list/list' }); },
  goOrderType(e) {
    const i = e.currentTarget.dataset.i;
    wx.navigateTo({ url: `/package-order/pages/order/list/list?status=${i}` });
  },
  goFavor() { wx.navigateTo({ url: '/pages/favor/favor' }).catch(() => {}); },
  goMember() { wx.navigateTo({ url: '/package-user/pages/member/member' }); },
  goStore() { wx.navigateTo({ url: '/package-user/pages/store/list/list' }); },
  goInvite() { wx.navigateTo({ url: '/package-user/pages/invite/invite' }); },
  goService() { wx.navigateTo({ url: '/package-promo/pages/service/market/market' }); },
  goVerify() { wx.navigateTo({ url: '/package-user/pages/verify/center/center' }); },
  goFinance() { wx.navigateTo({ url: '/package-user/pages/finance/center/center' }); },
  goChat() {
    wx.navigateTo({ url: '/package-chat/pages/chat/session/session' }).catch(() => {
      wx.switchTab({ url: '/pages/my/my' });
    });
  },
  goAddress() { wx.navigateTo({ url: '/package-address/pages/address/list/list' }); },
  goAgreement() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=agreement' }); },
  goPrivacy() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=privacy' }); },
  goAbout() { wx.navigateTo({ url: '/package-cms/pages/cms/page/page?slug=about' }); },
  goSeckill() { wx.navigateTo({ url: '/package-user/pages/seckill/seckill' }); },
  goGroup() { wx.navigateTo({ url: '/package-promo/pages/group/list/list' }); },
  goLuckyBag() { wx.navigateTo({ url: '/package-user/pages/luckybag/luckybag' }); },
  goCustom() { wx.navigateTo({ url: '/package-promo/pages/service/custom/custom' }); }
});
