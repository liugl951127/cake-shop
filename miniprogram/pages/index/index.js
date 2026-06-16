const { request } = require('../../utils/request.js');
const { login } = require('../../utils/auth.js');

Page({
  data: {
    banners: [
      { id: 1, emoji: '🎂', gradient: 'linear-gradient(135deg,#ffb1cc,#ff7eb3)', title: '草莓鲜奶蛋糕', sub: '9 折尝鲜价 ¥99', url: '/pages/goods/goods' },
      { id: 2, emoji: '🍰', gradient: 'linear-gradient(135deg,#ffd6a5,#ff9a76)', title: '提拉米苏', sub: '买一送一', url: '/pages/goods/goods' },
      { id: 3, emoji: '🍫', gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', title: '巧克力熔岩', sub: '新品上市', url: '/pages/goods/goods' }
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

  onLoad(q) {
    this._inviterCode = (q && q.inviter) || '';
    login({ inviterCode: this._inviterCode })
      .then(u => {
        this.setData({ userOpenid: u.openid });
        // 如果携带着邀请码,尝试绑定
        if (this._inviterCode) this.bindInviter(this._inviterCode);
      })
      .catch(() => {});
    this.loadRecommend();
    this.loadSeckill();
  },

  bindInviter(code) {
    request('bindInviter', { inviterCode: code }, { loading: false, silent: true })
      .then((r) => {
        if (r && r.bound) {
          wx.showToast({ title: `绑定邀请人:${r.inviterName || '成功'}`, icon: 'success' });
        }
      })
      .catch(() => {});
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
    nav.to('/pages/search/search');
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

  goSeckill() { nav.to('/pages/seckill/seckill'); },
  goGroup() { nav.to('/pages/group/list/list'); },
  goCoupon() { nav.to('/pages/coupon/center/center'); },
  goMember() { nav.to('/pages/member/member'); },
  goStore() { nav.to('/pages/store/list/list'); }
});
