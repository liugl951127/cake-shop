const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');

Page({
  data: { list: [], loading: false },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('getCmsNotices', { page: 1, pageSize: 20 });
      this.setData({
        list: list.map(n => ({ ...n, createTimeText: formatTime(new Date(n.createTime), 'YYYY-MM-DD') }))
      });
    } catch (e) {}
    this.setData({ loading: false });
  },

  goPage(e) {
    const slug = e.currentTarget.dataset.slug;
    if (slug) {
      wx.navigateTo({ url: `/pages/cms/page/page?slug=${slug}` });
    }
  }
});
