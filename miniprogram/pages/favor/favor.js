const { request } = require('../../utils/request.js');

Page({
  data: { list: [], loading: false },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('getFavorites', {}, { loading: false });
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  async unfavor(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('removeFavorite', { id });
      this.load();
    } catch (err) {}
  }
});
