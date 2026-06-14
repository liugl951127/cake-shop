const { request } = require('../../../utils/request.js');

Page({
  data: { list: [], loading: false, status: '' },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  switchTab(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ status: v });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('adminGetOrders', { status: this.data.status }, { loading: false });
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  async updateStatus(e) {
    const { id, v } = e.currentTarget.dataset;
    try {
      await request('adminUpdateOrder', { id, status: Number(v) });
      this.load();
    } catch (err) {}
  }
});
