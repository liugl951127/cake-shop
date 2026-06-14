// 审计日志
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');

Page({
  data: {
    list: [], filter: '', page: 1, pageSize: 20, hasMore: false
  },

  onShow() {
    this.setData({ list: [], page: 1 });
    this.load(true);
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.k, list: [], page: 1 });
    this.load(true);
  },

  async load(reset = false) {
    try {
      const r = await request('rbac', {
        action: 'logs',
        page: reset ? 1 : this.data.page,
        pageSize: this.data.pageSize,
        actionFilter: this.data.filter
      }, { loading: false, silent: true });
      const list = (r.list || []).map(l => ({
        ...l,
        createTimeText: formatTime(l.createTime)
      }));
      this.setData({
        list: reset ? list : this.data.list.concat(list),
        page: (reset ? 1 : this.data.page) + 1,
        hasMore: r.hasMore
      });
    } catch (e) {}
  },

  loadMore() { this.load(); }
});
