// 营销自动化
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');

const RULES = [
  { code: 'BIRTHDAY', name: '生日礼', icon: '🎂', description: '用户生日前 7 天推送专属生日券' },
  { code: 'SILENT', name: '沉默唤醒', icon: '😴', description: '14-30 天未活跃,送 5 元无门槛券' },
  { code: 'LOST', name: '流失挽回', icon: '💔', description: '60+ 天未登录,送 30 元大额券' },
  { code: 'HIGH_VALUE', name: 'VIP 关怀', icon: '👑', description: '累计消费 ≥ 1000,每月送专属福利' },
  { code: 'FIRST_ORDER', name: '首单激励', icon: '🎁', description: '注册 3 天未下单,送 10 元券' }
];

Page({
  data: {
    rules: RULES.map(r => ({ ...r, totalSent: 0, totalConverted: 0, conversionRate: 0, lastRunText: '' })),
    lastLogs: []
  },

  onShow() { this.load(); },

  async load() {
    try {
      const r = await request('getMarketingStats', {}, { loading: false, silent: true });
      // 合并本地规则
      const merged = RULES.map(rule => {
        const stat = (r.stats || []).find(s => s.code === rule.code) || {};
        const lastLog = (r.lastLogs || []).find(l => l.ruleCode === rule.code);
        return {
          ...rule,
          totalSent: stat.totalSent || 0,
          totalConverted: stat.totalConverted || 0,
          conversionRate: stat.conversionRate || 0,
          lastSent: lastLog ? lastLog.result.sent : 0,
          lastRunText: lastLog ? formatTime(lastLog.createTime) : ''
        };
      });
      this.setData({ rules: merged });
    } catch (e) {}
  },

  async onRunAll() {
    wx.showLoading({ title: '执行中' });
    try {
      const r = await request('marketingTrigger', {}, { loading: false });
      wx.hideLoading();
      wx.showModal({
        title: '执行完成',
        content: r.rules.map(x => `${x.name}: ${x.sent || 0}`).join('\n'),
        showCancel: false
      });
      this.load();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '失败', icon: 'none' });
    }
  },

  onDryRun() {
    wx.showLoading({ title: '模拟中' });
    request('marketingTrigger', { dryRun: true }, { loading: false }).then((r) => {
      wx.hideLoading();
      wx.showModal({
        title: '模拟完成',
        content: r.rules.map(x => `${x.name}: 模拟触达`).join('\n'),
        showCancel: false
      });
    });
  },

  async onRunOne(e) {
    const code = e.currentTarget.dataset.c;
    wx.showLoading({ title: '执行中' });
    try {
      await request('marketingTrigger', { ruleCode: code }, { loading: false });
      wx.hideLoading();
      wx.showToast({ title: '已完成' });
      this.load();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '失败', icon: 'none' });
    }
  }
});
