const { request } = require('../../../utils/request.js');
const { orderStatusMap } = require('../../../utils/util.js');

Page({
  data: {
    data: null,
    statusList: [],
    maxCount: 0
  },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    try {
      const data = await request('getDashboard', {});
      const statusList = Object.entries(orderStatusMap).map(([k, v]) => ({
        value: k, name: v.text, color: v.color, count: data.statusDist[k] || 0
      }));
      const maxCount = Math.max(...data.trend.map(t => t.count), 1);
      this.setData({ data, statusList, maxCount });
    } catch (e) {}
  },

  barHeight(count, max) {
    return Math.max(10, (count / max) * 70);
  },

  fWidth(rate) {
    return Math.max(20, Math.min(100, Number(rate) || 0));
  }
});
