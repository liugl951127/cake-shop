const { request } = require('../../utils/request.js');
const { orderStatusMap } = require('../../utils/util.js');

Page({
  data: {
    tabs: [
      { label: '全部', value: '' },
      { label: '待付款', value: 0 },
      { label: '制作中', value: 2 },
      { label: '配送中', value: 3 },
      { label: '已完成', value: 4 }
    ],
    status: '',
    list: [],
    loading: false,
    statusMap: orderStatusMap
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  switchTab(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ status: v });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('getOrders', { status: this.data.status }, { loading: false });
      this.setData({ list: list.map(o => ({ ...o, totalCount: o.items.reduce((s, i) => s + i.count, 0) })) });
    } catch (e) {}
    this.setData({ loading: false });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/order/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  async cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    const res = await wx.showModal({ title: '提示', content: '确认取消订单?' });
    if (!res.confirm) return;
    try {
      await request('cancelOrder', { id });
      this.load();
    } catch (e) {}
  },

  async payOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '支付中' });
    try {
      await request('payCallback', { orderId: id, payResult: 'success' });
      wx.hideLoading();
      wx.showToast({ title: '支付成功' });
      this.load();
    } catch (e) { wx.hideLoading(); }
  },

  async confirmOrder(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('confirmReceive', { id });
      this.load();
    } catch (e) {}
  },

  async deleteOrder(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('cancelOrder', { id, remove: true });
      this.load();
    } catch (e) {}
  }
});
