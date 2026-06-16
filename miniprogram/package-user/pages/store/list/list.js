const { request } = require('../../../../utils/request.js');

Page({
  data: { list: [], location: '', loading: false },

  onLoad() { this.load(); },

  async load(lng, lat) {
    this.setData({ loading: true });
    try {
      const list = await request('getStores', { lng, lat });
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ location: `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}` });
        this.load(res.longitude, res.latitude);
      },
      fail: () => {
        wx.showToast({ title: '获取位置失败', icon: 'none' });
        this.load();
      }
    });
  },

  onSelect(e) {
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('selectStore', item);
    wx.navigateBack();
  },

  callPhone(e) {
    wx.makePhoneCall({ phoneNumber: e.currentTarget.dataset.phone });
  }
});
