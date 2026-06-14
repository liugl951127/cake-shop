// 财务中心
const { request } = require('../../../utils/request.js');
const { formatTime } = require('../../../utils/util.js');

const WT_TEXT = { 0: '审核中', 1: '处理中', 2: '已到账', '-1': '已拒绝' };

Page({
  data: {
    account: {},
    overview: { today: {}, month: {}, pending: {} },
    withdraws: [],
    wt: -999
  },

  onShow() { this.load(); },

  async load() {
    try {
      const [acc, ov, wd] = await Promise.all([
        request('finance', { action: 'account' }, { loading: false, silent: true }),
        request('finance', { action: 'overview' }, { loading: false, silent: true }),
        request('finance', { action: 'withdrawList', status: this.data.wt, page: 1, pageSize: 30 }, { loading: false, silent: true })
      ]);
      this.setData({
        account: acc,
        overview: ov,
        withdraws: (wd.list || []).map(w => ({ ...w, createTimeText: formatTime(w.createTime) }))
      });
    } catch (e) {}
  },

  wtText(status) { return WT_TEXT[status] || '处理中'; },

  setWT(e) {
    this.setData({ wt: Number(e.currentTarget.dataset.k) });
    this.load();
  },

  onWithdraw() {
    const available = this.data.account.available || 0;
    const min = this.data.account.minWithdraw || 100;
    if (available < min) {
      return wx.showToast({ title: `满 ${min} 元才能提现`, icon: 'none' });
    }
    wx.showModal({
      title: '申请提现',
      content: `可提现 ¥${available},提现多少?`,
      editable: true,
      placeholderText: '请输入金额',
      success: async (res) => {
        if (!res.confirm) return;
        const amount = Number(res.content);
        if (!amount || amount < min) return wx.showToast({ title: `最低 ${min} 元`, icon: 'none' });
        try {
          await request('finance', {
            action: 'withdraw',
            amount,
            method: 'wxpay',
            account: '微信零钱'
          });
          wx.showToast({ title: '已申请,等待审核' });
          this.load();
        } catch (err) {
          wx.showToast({ title: err.msg || '失败', icon: 'none' });
        }
      }
    });
  },

  onReconcile() {
    wx.showLoading({ title: '对账中' });
    request('finance', { action: 'reconcile' }, { loading: false }).then((r) => {
      wx.hideLoading();
      wx.showModal({
        title: '对账完成',
        content: `订单 ¥${r.orderAmount}\n退款 ¥${r.refundAmount}\n提现 ¥${r.withdrawAmount}\n净额 ¥${r.net}`,
        showCancel: false
      });
    }).catch(() => wx.hideLoading());
  }
});
