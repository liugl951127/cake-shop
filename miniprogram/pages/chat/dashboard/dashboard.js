const { request } = require('../../../utils/request.js');

Page({
  data: { data: null, responseText: '-', maxCount: 0 },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    try {
      const data = await request('getChatDashboard', { days: 7 });
      const ms = data.overview.avgResponseMs || 0;
      const responseText = ms < 1000
        ? `${ms}ms`
        : ms < 60000
          ? `${(ms / 1000).toFixed(1)}s`
          : `${(ms / 60000).toFixed(1)}min`;
      const maxCount = Math.max(...data.dailyTrend.map(t => t.count), 1);
      this.setData({ data, responseText, maxCount });
    } catch (e) {}
  },

  barHeight(count, max) {
    return Math.max(10, (count / max) * 70);
  },

  scorePercent(score) {
    if (!this.data.data) return 0;
    const dist = this.data.data.scoreDist;
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    return (dist[score] || 0) / total * 100;
  }
});
