const { request } = require('../../../../utils/request.js');

Page({
  data: { list: [], loading: false, select: false },

  onLoad(options) {
    this.setData({ select: options.select === '1' });
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('getAddress', {}, { loading: false });
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  onTap(e) {
    if (!this.data.select) return;
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('selectAddress', item);
    wx.navigateBack();
  },

  add() {
    nav.to('/pages/address/edit/edit');
  },

  edit(e) {
    wx.navigateTo({ url: `/pages/address/edit/edit?id=${e.currentTarget.dataset.id}` });
  },

  async setDefault(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('setDefaultAddress', { id });
      this.load();
    } catch (e) {}
  },

  async remove(e) {
    const id = e.currentTarget.dataset.id;
    const r = await wx.showModal({ title: '提示', content: '确认删除该地址?' });
    if (!r.confirm) return;
    try {
      await request('deleteAddress', { id });
      this.load();
    } catch (e) {}
  }
});
