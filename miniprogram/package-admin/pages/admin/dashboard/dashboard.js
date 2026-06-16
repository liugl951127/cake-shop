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
      const maxCount = Math.max(0, ...(data.trend || []).map(t => t.count || 0), 1);
      // 预处理: 模板里不能调方法,预先算 barHeight
      if (data.trend) {
        data.trend.forEach(t => {
          t.barHeight = Math.max(10, ((t.count || 0) / maxCount) * 70);
        });
      }
      // 预处理: 转化漏斗宽度
      if (data.conversion) {
        data.conversion.cartWidth = Math.max(20, Math.min(100, Number(data.conversion.cartRate) || 0));
        data.conversion.orderWidth = Math.max(20, Math.min(100, Number(data.conversion.orderRate) || 0));
      }
      this.setData({ data, statusList, maxCount });
    } catch (e) {}
  },

  barHeight(count, max) {
    return Math.max(10, (count / max) * 70);
  },

  goRealtime() { nav.to('/package-admin/pages/admin/dashboard2/dashboard2'); },

  goRealtime() { nav.to('/package-admin/pages/admin/dashboard2/dashboard2'); },
  goPlugins() { nav.to('/package-admin/pages/admin/plugins/plugins'); },
  goLowcode() { nav.to('/package-admin/pages/admin/lowcode/lowcode'); },
  goRisk() { nav.to('/package-admin/pages/admin/risk/risk'); },

  fWidth(rate) {
    return Math.max(20, Math.min(100, Number(rate) || 0));
  }
});
