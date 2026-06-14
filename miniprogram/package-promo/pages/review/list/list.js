// 评价列表
const { request } = require('../../../../utils/request.js');
const { getUser } = require('../../../../utils/auth.js');
const { formatTime } = require('../../../../utils/util.js');

Page({
  data: {
    goodsId: '',
    shopId: '',
    filter: 'all',
    list: [],
    summary: {},
    page: 1,
    pageSize: 10,
    finished: false,
    loading: false,
    canAppend: true,
    myOpenid: ''
  },

  onLoad(q) {
    const me = getUser();
    this.setData({
      goodsId: q.goodsId || '',
      shopId: q.shopId || '',
      myOpenid: me && me.openid ? me.openid : ''
    });
    this.loadSummary();
    this.load(true);
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.k, page: 1, list: [], finished: false });
    this.load(true);
  },

  async loadSummary() {
    // 简化: 直接用列表首条 + 自己算
  },

  async load(reset = false) {
    if (this.data.loading) return;
    if (this.data.finished && !reset) return;
    this.setData({ loading: true });

    const page = reset ? 1 : this.data.page;
    try {
      const r = await request('getReviews', {
        goodsId: this.data.goodsId,
        shopId: this.data.shopId,
        filter: this.data.filter,
        page, pageSize: this.data.pageSize
      }, { loading: false, silent: true });
      const list = (r.list || []).map(it => ({ ...it, createTimeText: formatTime(it.createTime) }));
      const newList = reset ? list : this.data.list.concat(list);
      this.setData({
        list: newList,
        page: page + 1,
        finished: !r.hasMore,
        loading: false
      });
      this.calcSummary(newList);
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  calcSummary(list) {
    if (!list.length) return;
    const total = list.length;
    const sum = list.reduce((s, r) => s + (r.score || 0), 0);
    const avg = Number((sum / total).toFixed(1));
    const good = list.filter(r => (r.score || 0) >= 4).length;
    const goodRate = Math.round((good / total) * 100);
    this.setData({ summary: { avgScore: avg, total, goodRate } });
  },

  onReachBottom() { this.load(); },

  onLike(e) {
    const { id, index } = e.currentTarget.dataset;
    const item = this.data.list[index];
    if (!item) return;
    const liked = !item.liked;
    this.data.list[index].liked = liked;
    this.data.list[index].likeCount = (item.likeCount || 0) + (liked ? 1 : -1);
    this.setData({ list: this.data.list });
    request('likeReview', { reviewId: id, action: liked ? 'like' : 'unlike' }, { loading: false, silent: true });
  },

  onPreview(e) {
    const { i, list } = e.currentTarget.dataset;
    wx.previewImage({ current: list[i], urls: list });
  },

  onAppend(e) {
    const id = e.currentTarget.dataset.id;
    nav.to('/package-promo/pages/review/edit/edit?reviewId=' + id);
  }
});
