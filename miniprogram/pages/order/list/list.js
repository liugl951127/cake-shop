// 订单列表
const { request } = require('../../../../utils/request.js');
const nav = require('../../../../utils/nav.js');
const { formatTime } = require('../../../../utils/util.js');

const STATUS = {
  '0': '待付款', '1': '待发货', '2': '配送中', '3': '待收货', '4': '已完成',
  '-1': '已取消', '-2': '已退款', '-3': '已拦截'
};

Page({
  data: {
    tab: -1, page: 1, pageSize: 20, list: [], finished: false, loading: false
  },

  onLoad(q) {
    if (q.status) this.setData({ tab: Number(q.status) });
  },

  onShow() { this.setData({ list: [], page: 1, finished: false }); this.load(true); },

  statusText(s) { return STATUS[s] || '处理中'; },

  setTab(e) {
    this.setData({ tab: Number(e.currentTarget.dataset.k), list: [], page: 1, finished: false });
    this.load(true);
  },

  async load(reset = false) {
    if (this.data.loading || (this.data.finished && !reset)) return;
    this.setData({ loading: true });
    const page = reset ? 1 : this.data.page;
    const r = await request('getOrders', {
      page, pageSize: this.data.pageSize,
      status: this.data.tab === -1 ? undefined : this.data.tab
    }, { loading: false, silent: true });
    const list = (r.list || []).map(o => {
      const count = o.goodsCount || (o.goods && o.goods.length) || 0;
      return {
        ...o,
        createTimeText: formatTime(o.createTime),
        goodsCountText: String(count),
        totalPrice: o.totalPrice != null ? o.totalPrice : (o.total || 0)
      };
    });
    this.setData({
      list: reset ? list : this.data.list.concat(list),
      page: page + 1,
      finished: !r.hasMore,
      loading: false
    });
  },

  onReachBottom() { this.load(); },

  onDetail(e) {
    const id = e.currentTarget.dataset.id || e.currentTarget.dataset._id;
    nav.to('/package-order/pages/order/detail/detail?id=' + id);
  },

  onPay(e) {
    const id = e.currentTarget.dataset.id;
    nav.to('/pages/order/order?orderId=' + id);
  },

  async onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单', content: '确认取消?', success: async (r) => {
        if (r.confirm) {
          await request('cancelOrder', { id }).catch(() => {});
          this.onShow();
        }
      }
    });
  },

  async onConfirm(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('confirmReceive', { id }, { loading: false });
      wx.showToast({ title: '已确认收货' });
      this.onShow();
    } catch (err) {}
  }
});
