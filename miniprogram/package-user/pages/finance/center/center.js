// 财务中心
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');
const nav = require('../../../../utils/nav');

const WT_STATUS = {
  'pending': '待审核',
  'approved': '已通过',
  'rejected': '已拒绝',
  'paid': '已打款',
  'failed': '失败'
};

Page({
  data: {
    balance: { available: 0, frozen: 0, total: 0 },
    summary: { todayIncome: 0, monthIncome: 0, totalIncome: 0 },
    withdraws: [],
    page: 1,
    finished: false,
    loading: false
  },

  onShow() { this.load(true); },
  onPullDownRefresh() { this.load(true).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.load(false); },

  async load(reset) {
    if (this.data.loading) return;
    if (reset) {
      this.setData({ withdraws: [], page: 1, finished: false });
    }
    if (this.data.finished) return;
    this.setData({ loading: true });
    try {
      const r = await request('userFinanceList', { page: this.data.page });
      const rows = (r.list || r.data || []).map(w => {
        return Object.assign({}, w, {
          statusText: WT_STATUS[w.status] || w.status,
          createTimeText: formatTime(w.createTime, 'YYYY-MM-DD HH:mm:ss')
        });
      });
      this.setData({
        balance: r.balance || this.data.balance,
        summary: r.summary || this.data.summary,
        withdraws: this.data.withdraws.concat(rows),
        page: this.data.page + 1,
        finished: rows.length === 0 || rows.length < 10
      });
    } catch (e) {
      console.warn('finance load err:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onWithdraw() {
    nav.to('/package-user/pages/finance/withdraw/withdraw');
  }
});
