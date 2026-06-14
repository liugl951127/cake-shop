const { request } = require('../../utils/request.js');

Page({
  data: {
    categories: [],
    currentCat: '',
    keyword: '',
    list: [],
    page: 1,
    pageSize: 20,
    loading: false,
    finished: false
  },

  onLoad(options) {
    if (options.category) this.setData({ currentCat: options.category });
    if (options.keyword) this.setData({ keyword: options.keyword });
    this.loadCategories();
  },

  onShow() {
    if (this.data.categories.length === 0) this.loadCategories();
    if (this.data.list.length === 0) this.refresh();
  },

  async loadCategories() {
    try {
      const cats = await request('getCategories', {}, { loading: false });
      this.setData({
        categories: cats,
        currentCat: this.data.currentCat || (cats[0] && cats[0]._id) || ''
      });
      this.refresh();
    } catch (e) {}
  },

  selectCat(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.currentCat) return;
    this.setData({ currentCat: id });
    this.refresh();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.refresh();
  },

  refresh() {
    this.setData({ list: [], page: 1, finished: false });
    this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || this.data.finished) return;
    this.setData({ loading: true });
    try {
      const list = await request('getGoods', {
        page: this.data.page,
        pageSize: this.data.pageSize,
        category: this.data.currentCat,
        keyword: this.data.keyword
      }, { loading: false });
      this.setData({
        list: [...this.data.list, ...list],
        page: this.data.page + 1,
        finished: list.length < this.data.pageSize
      });
    } catch (e) {}
    this.setData({ loading: false });
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    this.refresh();
    setTimeout(() => wx.stopPullDownRefresh(), 500);
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
});
