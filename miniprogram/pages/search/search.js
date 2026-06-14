const { request } = require('../../utils/request.js');
const { getUser } = require('../../utils/auth.js');

Page({
  data: {
    keyword: '',
    autoFocus: true,
    history: [],
    hot: [],
    goods: [],
    searched: false,
    loading: false
  },

  _debounce: null,

  onLoad() {
    this.load();
  },

  async load() {
    try {
      const openid = (getUser() || {}).openid || '';
      const r = await request('searchGoods', { openid }, { loading: false, silent: true });
      this.setData({
        history: r.history || [],
        hot: r.hot || [],
        goods: r.goods || []
      });
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
    // 防抖联想
    clearTimeout(this._debounce);
    if (e.detail.value) {
      this._debounce = setTimeout(() => this.search(e.detail.value), 500);
    }
  },

  onSearch() {
    this.search(this.data.keyword);
  },

  async search(keyword) {
    if (!keyword || !keyword.trim()) {
      this.setData({ searched: false, goods: [] });
      return;
    }
    this.setData({ loading: true, searched: true, keyword });
    try {
      const openid = (getUser() || {}).openid || '';
      const r = await request('searchGoods', { keyword: keyword.trim(), openid, saveHistory: true });
      this.setData({
        goods: r.goods || [],
        history: r.history || []
      });
    } catch (e) {}
    this.setData({ loading: false });
  },

  onTagTap(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ keyword: k });
    this.search(k);
  },

  clear() {
    this.setData({ keyword: '', searched: false, goods: [] });
  },

  async clearHistory() {
    // 清空本地缓存 + 云端行为记录
    try {
      const openid = (getUser() || {}).openid;
      if (openid) {
        // 不提供直接清空 API,简单做:本地清空
        this.setData({ history: [] });
      }
    } catch (e) {}
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  goBack() { wx.navigateBack(); }
});
