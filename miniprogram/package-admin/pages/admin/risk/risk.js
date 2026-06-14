// 风控中心
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');

const DEC_TEXT = { pass: '放行', verify: '补认证', manual: '人工审', reject: '拦截' };
const TYPES = ['user', 'device', 'ip', 'phone', 'idcard'];

Page({
  data: {
    tab: 'dashboard',
    dash: { today: {}, trend: [], topRules: [] },
    reviewList: [],
    logs: [],
    rulesList: { builtin: [] },
    thresholds: [],
    blacklist: [],
    fScenario: ''
  },

  onShow() {
    this.loadDashboard();
    this.loadReview();
    this.loadBlack();
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.k });
    if (e.currentTarget.dataset.k === 'review') this.loadReview();
    else if (e.currentTarget.dataset.k === 'logs') this.loadLogs();
    else if (e.currentTarget.dataset.k === 'rules') this.loadRules();
    else if (e.currentTarget.dataset.k === 'blacklist') this.loadBlack();
  },

  decText(s) { return DEC_TEXT[s] || s; },

  async loadDashboard() {
    try {
      const r = await request('riskEngine', { action: 'dashboard' }, { loading: false, silent: true });
      this.setData({ dash: r });
    } catch (e) {}
  },

  async loadReview() {
    try {
      const r = await request('riskEngine', { action: 'logs', scenario: '', decision: 'manual', page: 1, pageSize: 30 }, { loading: false, silent: true });
      const list = (r.list || []).map(l => ({ ...l, createTimeText: formatTime(l.createTime) }));
      this.setData({ reviewList: list });
    } catch (e) {}
  },

  setFScenario(e) {
    this.setData({ fScenario: e.currentTarget.dataset.k });
    this.loadLogs();
  },

  async loadLogs() {
    try {
      const r = await request('riskEngine', { action: 'logs', scenario: this.data.fScenario, page: 1, pageSize: 30 }, { loading: false, silent: true });
      const list = (r.list || []).map(l => ({ ...l, createTimeText: formatTime(l.createTime) }));
      this.setData({ logs: list });
    } catch (e) {}
  },

  async loadRules() {
    try {
      const r = await request('riskEngine', { action: 'rules' }, { loading: false, silent: true });
      this.setData({
        rulesList: r,
        thresholds: Object.entries(r.thresholds || {}).map(([k, v]) => ({ scenario: k, ...v }))
      });
    } catch (e) {}
  },

  async loadBlack() {
    try {
      const r = await request('blacklist', { action: 'list', page: 1, pageSize: 30 }, { loading: false, silent: true });
      const list = (r.list || []).map(b => ({ ...b, createTimeText: formatTime(b.createTime) }));
      this.setData({ blacklist: list });
    } catch (e) {}
  },

  onReview(e) {
    const i = e.currentTarget.dataset.i;
    const item = this.data.reviewList[i];
    wx.showModal({
      title: '人工审核',
      content: `分数 ${item.totalScore} · 命中:${item.factors.filter(f => f.hit).map(f => f.code).join(',')}`,
      editable: true,
      placeholderText: '请输入审核意见',
      success: async (res) => {
        if (!res.confirm) return;
        const action = res.content && res.content.includes('拒') ? 'reject' : 'approve';
        try {
          await request('riskEngine', {
            action: 'review', logId: item._id, action, note: res.content || ''
          }, { loading: false });
          wx.showToast({ title: action === 'approve' ? '已通过' : '已拒绝' });
          this.loadReview();
          this.loadDashboard();
        } catch (e) {
          wx.showToast({ title: '失败', icon: 'none' });
        }
      }
    });
  },

  onAddBlack() {
    wx.showModal({
      title: '加黑',
      editable: true,
      placeholderText: `格式: type,value,reason\ntype: ${TYPES.join('/')}`,
      success: async (res) => {
        if (!res.confirm) return;
        const [type, value, reason] = (res.content || '').split(/[,，\s]+/);
        if (!TYPES.includes(type) || !value) {
          return wx.showToast({ title: '格式错误', icon: 'none' });
        }
        try {
          await request('blacklist', { action: 'add', type, value, reason: reason || '', level: 'high' }, { loading: false });
          wx.showToast({ title: '已加黑' });
          this.loadBlack();
        } catch (e) {
          wx.showToast({ title: e.msg || '失败', icon: 'none' });
        }
      }
    });
  },

  async onUnBlack(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('blacklist', { action: 'remove', id }, { loading: false });
      wx.showToast({ title: '已移黑' });
      this.loadBlack();
    } catch (e) {
      wx.showToast({ title: '失败', icon: 'none' });
    }
  }
});
