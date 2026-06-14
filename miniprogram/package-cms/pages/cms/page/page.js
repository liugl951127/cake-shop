const { request } = require('../../../utils/request.js');

Page({
  data: { page: {} },

  onLoad(options) {
    this.setData({ slug: options.slug });
    this.load();
  },

  async load() {
    try {
      const page = await request('getCmsPage', { slug: this.data.slug });
      this.setData({ page });
      if (page.title) wx.setNavigationBarTitle({ title: page.title });
    } catch (e) {
      wx.showToast({ title: '页面不存在', icon: 'none' });
    }
  }
});
