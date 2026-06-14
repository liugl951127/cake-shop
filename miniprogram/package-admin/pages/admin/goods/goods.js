const { request } = require('../../../utils/request.js');

Page({
  data: { list: [], loading: false },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    this.setData({ loading: true });
    try {
      // 管理员接口走 adminGetOrders 模式:商品直接用 getGoods
      const list = await request('getGoods', { page: 1, pageSize: 100 }, { loading: false });
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  add() { nav.to('/pages/admin/edit/edit'); },
  edit(e) { wx.navigateTo({ url: `/pages/admin/edit/edit?id=${e.currentTarget.dataset.id}` }); },

  async del(e) {
    const id = e.currentTarget.dataset.id;
    const r = await wx.showModal({ title: '提示', content: '确认下架该商品?' });
    if (!r.confirm) return;
    try {
      await request('adminDeleteGoods', { id });
      this.load();
    } catch (e) {}
  }
});
