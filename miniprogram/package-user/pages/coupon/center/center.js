const { request } = require('../../utils/request.js');
const { formatTime } = require('../../utils/util.js');

Page({
  data: { tab: 'center', centerList: [], myList: [], filter: 0 },

  onShow() {
    if (this.data.tab === 'center') this.loadCenter();
    else this.loadMine();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
    if (this.data.tab === 'center') this.loadCenter();
    else this.loadMine();
  },

  setFilter(e) {
    this.setData({ filter: Number(e.currentTarget.dataset.f) });
    this.loadMine();
  },

  async loadCenter() {
    try {
      const list = await request('getCouponList', {});
      const my = await request('getCoupons', { status: 0 }, { loading: false, silent: true }).catch(() => []);
      const myIds = new Set(my.map(c => c.couponId));
      this.setData({
        centerList: list.map(c => ({ ...c, received: myIds.has(c._id) }))
      });
    } catch (e) {}
  },

  async loadMine() {
    try {
      const list = await request('getCoupons', { status: this.data.filter });
      this.setData({
        myList: list.map(c => ({
          ...c,
          expireTimeText: c.expireTime ? formatTime(new Date(c.expireTime), 'YYYY-MM-DD') : '永久'
        }))
      });
    } catch (e) {}
  },

  async onReceive(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('receiveCoupon', { couponId: id });
      wx.showToast({ title: '领取成功' });
      this.loadCenter();
    } catch (e) {}
  }
});
