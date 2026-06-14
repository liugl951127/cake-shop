const { request } = require('../../utils/request.js');
const { login } = require('../../utils/auth.js');

Page({
  data: {
    banners: [
      { id: 1, image: 'https://img.zcool.cn/community/01a87d5e8c4e5da8012051cd9c0e8a.jpg', url: '' },
      { id: 2, image: 'https://img.zcool.cn/community/01b3eb5e8c4e5ea8012051cd3ed57a.jpg', url: '' },
      { id: 3, image: 'https://img.zcool.cn/community/01d7b75e8c4e5ea8012051cd86e0aa.jpg', url: '' }
    ],
    icons: [
      { id: 'cake',    name: '蛋糕',   emoji: '🎂', color: '#ffe4ec' },
      { id: 'bread',   name: '面包',   emoji: '🍞', color: '#fff4d6' },
      { id: 'cookie',  name: '饼干',   emoji: '🍪', color: '#e0f4ff' },
      { id: 'gift',    name: '送礼',   emoji: '🎁', color: '#e6f7e6' },
      { id: 'custom',  name: '定制',   emoji: '✨', color: '#f0e6ff' }
    ],
    notice: '新人首单立减 10 元, 满 99 包邮!',
    seckillList: [],
    recommend: [],
    page: 1,
    loading: false,
    finished: false
  },

  onLoad() {
    login().then(u => this.setData({ userOpenid: u.openid })).catch(() => {});
    this.loadRecommend();
    this.loadSeckill();
  },

  onShow() {
    if (this.data.userOpenid) this.loadPersonalized();
  },

  onPullDownRefresh() {
    this.setData({ recommend: [], page: 1, finished: false });
    this.loadRecommend().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading) return;
    this.loadRecommend();
  },

  async loadRecommend() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const list = await request('getGoods', {
        page: this.data.page,
        pageSize: 10,
        recommend: true
      }, { loading: false });
      this.setData({
        recommend: [...this.data.recommend, ...list],
        page: this.data.page + 1,
        finished: list.length < 10
      });
    } catch (e) {}
    this.setData({ loading: false });
  },

  // 个性化推荐(后插入顶部)
  async loadPersonalized() {
    try {
      const list = await request('getRecommend', {
        openid: this.data.userOpenid,
        pageSize: 6
      }, { loading: false, silent: true });
      if (list.length) {
        this.setData({ recommend: [...list, ...this.data.recommend] });
      }
    } catch (e) {}
  },

  async loadSeckill() {
    try {
      const list = await request('getSeckillList', {});
      this.setData({ seckillList: list.filter(s => s.state === 'ongoing').slice(0, 6) });
    } catch (e) {}
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/goods/goods?keyword=' });
  },

  onIconTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/goods/goods?category=${id}` });
  },

  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.url) {
      wx.navigateTo({ url: `/pages/webview/webview?url=${encodeURIComponent(item.url)}&title=活动详情` });
    }
  },

  goSeckill() { wx.navigateTo({ url: '/pages/seckill/seckill' }); },
  goGroup() { wx.navigateTo({ url: '/pages/group/list/list' }); },
  goCoupon() { wx.navigateTo({ url: '/pages/coupon/center/center' }); },
  goMember() { wx.navigateTo({ url: '/pages/member/member' }); },
  goStore() { wx.navigateTo({ url: '/pages/store/list/list' }); }
});
