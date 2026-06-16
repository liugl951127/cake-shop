// 客服数据看板
const { request } = require('../../../../utils/request.js');
const nav = require('../../../../utils/nav');

Page({
  data: {
    data: null,
    responseText: '-',
    maxCount: 0
  },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    try {
      const data = await request('chatDashboard', {});
      // 响应时长格式化
      const avgMs = data.overview && data.overview.avgResponseMs || 0;
      const responseText = avgMs < 1000
        ? avgMs + 'ms'
        : (avgMs / 1000).toFixed(1) + 's';
      // 评分分布百分比
      const dist = data.scoreDist || {};
      const totalScore = Object.values(dist).reduce((s, v) => s + (v || 0), 0) || 1;
      const scoreRows = [5, 4, 3, 2, 1].map(s => ({
        star: s,
        count: dist[s] || 0,
        percent: Math.round((dist[s] || 0) / totalScore * 100)
      }));
      // 每日趋势最大值 + 高度
      const maxCount = Math.max(0, ...(data.dailyTrend || []).map(t => t.count || 0), 1);
      if (data.dailyTrend) {
        data.dailyTrend.forEach(t => {
          t.barHeight = Math.max(10, ((t.count || 0) / maxCount) * 70);
        });
      }
      this.setData({ data, responseText, maxCount, scoreRows });
    } catch (e) {
      console.warn('chat dashboard load err:', e);
    }
  }
});
