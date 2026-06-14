// 拼团列表(附近 / 同城)
const { request } = require('../../../utils/request.js');

Page({
  data: {
    list: [],
    loading: false,
    location: '',
    locationTips: '点击定位',
    city: '',
    lng: 0,
    lat: 0,
    radius: 10
  },

  onShow() { this.load(); },

  onTapLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          lng: res.longitude, lat: res.latitude,
          locationTips: '已定位'
        });
        // 逆地址
        request('reverseGeocode', { lng: res.longitude, lat: res.latitude }, { loading: false, silent: true })
          .then((r) => {
            this.setData({ location: r.address || '附近', city: r.city || '' });
            this.load();
          })
          .catch(() => this.load());
      },
      fail: () => {
        wx.showToast({ title: '请授予定位权限', icon: 'none' });
      }
    });
  },

  setRadius(e) {
    this.setData({ radius: e.currentTarget.dataset.r });
    if (this.data.lng) this.load();
  },

  async load() {
    if (!this.data.lng) {
      // 无定位,加载默认(全国)
      try {
        const list = await request('getGoods', { page: 1, pageSize: 20 }, { loading: false });
        this.setData({ list: (list.list || list || []).filter(g => g.groupPrice).slice(0, 6) });
      } catch (e) {}
      return;
    }
    this.setData({ loading: true });
    try {
      const list = await request('getNearbyGroups', {
        lng: this.data.lng, lat: this.data.lat,
        city: this.data.city, maxDistance: this.data.radius
      }, { loading: false });
      this.setData({ list: list || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    const { id, g } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/package-promo/pages/group/detail/detail?goodsId=${id}&groupPrice=${g.groupPrice}&groupSize=${g.groupSize}` });
  }
});
