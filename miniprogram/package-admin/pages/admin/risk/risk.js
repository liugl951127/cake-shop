// 风控中心
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');
const nav = require('../../../../utils/nav');

const DECISION_TEXT = {
  'pass': '通过',
  'review': '人工审核',
  'reject': '拒绝',
  'block': '拦截'
};

Page({
  data: {
    list: [],
    page: 1,
    loading: false,
    finished: false,
    filters: { scenario: '', decision: '' }
  },

  onShow() { this.load(true); },

  onPullDownRefresh() { this.load(true).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.load(false); },

  async load(reset) {
    if (this.data.loading) return;
    if (reset) {
      this.setData({ list: [], page: 1, finished: false });
    }
    if (this.data.finished) return;
    this.setData({ loading: true });
    try {
      const r = await request('adminRiskList', { page: this.data.page, ...this.data.filters });
      const rows = (r.list || r.data || []).map(it => {
        return Object.assign({}, it, {
          decisionText: DECISION_TEXT[it.decision] || it.decision,
          createTimeText: formatTime(it.createTime, 'YYYY-MM-DD HH:mm:ss')
        });
      });
      this.setData({
        list: this.data.list.concat(rows),
        page: this.data.page + 1,
        finished: rows.length === 0 || rows.length < 10
      });
    } catch (e) {
      console.warn('risk load err:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onFilter(e) {
    const { k, v } = e.currentTarget.dataset || {};
    this.setData({ [`filters.${k}`]: v });
    this.load(true);
  },

  onDetail(e) {
    const { id } = e.currentTarget.dataset || {};
    if (!id) return;
    nav.to(`/package-admin/pages/admin/risk/detail/detail?id=${id}`);
  }
});
