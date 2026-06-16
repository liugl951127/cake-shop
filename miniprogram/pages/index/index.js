// 首页 - 蛋糕店
// 布局 (跟设计图一致):
//   1. 顶部 banner 区 (品牌 + 搜索 + 大轮播)
//   2. 6 格金刚区 (2x3: 蛋糕/甜品/面包/咖啡/常温点心/分享)
//   3. 公告条
//   4. 个性定制卡片
//   5. 限时秒杀 (拓展)
//   6. 为你推荐 (拓展)
//   7. 底部双卡 (会员权益 / 购买须知)
//   8. 悬浮客服 (电话 + 客服)
const { request } = require('../../utils/request.js');
const { login } = require('../../utils/auth.js');
const nav = require('../../utils/nav.js');

Page({
  data: {
    // 顶部 banner (3 个)
    banners: [
      { id: 1, emoji: '🎂', gradient: 'linear-gradient(135deg,#ffb1cc,#ff7eb3)', title: '草莓鲜奶蛋糕', sub: '9 折尝鲜价 ¥99', url: '/pages/goods/goods' },
      { id: 2, emoji: '🍰', gradient: 'linear-gradient(135deg,#ffd6a5,#ff9a76)', title: '提拉米苏', sub: '买一送一', url: '/pages/goods/goods' },
      { id: 3, emoji: '🍫', gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', title: '巧克力熔岩', sub: '新品上市', url: '/pages/goods/goods' }
    ],
    // 6 格金刚区
    icons: [
      { id: 'cake',   name: '生日蛋糕', en: 'birthday cake', emoji: '🎂', color: '#ffe4ec' },
      { id: 'sweet',  name: '甜品专区', en: 'Dessert',       emoji: '🍰', color: '#fff4d6' },
      { id: 'bread',  name: '手工面包', en: 'Bread',         emoji: '🥐', color: '#fef0e6' },
      { id: 'coffee', name: '咖啡饮品', en: 'Coffee drinks', emoji: '☕', color: '#f0e6d2' },
      { id: 'snack',  name: '常温点心', en: 'Snack',         emoji: '🍪', color: '#e0f4ff' },
      { id: 'share',  name: '分享有礼', en: 'Sharing courtesy', emoji: '🎁', color: '#fce4ec' }
    ],
    // 公告
    notice: '新人首单立减 10 元, 满 99 包邮!',
    // 秒杀
    seckillList: [],
    seckillEndText: '距结束 02:34:18',
    // 推荐
    recommend: [],
    page: 1,
    loading: false,
    finished: false,
    // 客服配置
    servicePhone: '400-123-4567',
    wechatServiceQr: ''   // 后台可配
  },

  onLoad(q) {
    this._inviterCode = (q && q.inviter) || '';
    login({ inviterCode: this._inviterCode })
      .then(u => {
        this.setData({ userOpenid: u.openid });
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

  async loadPersonalized() {
    try {
      const list = await request('getRecommend', {
        openid: this.data.userOpenid,
        pageSize: 6
      }, { loading: false, silent: true });
      if (list && list.length) {
        this.setData({ recommend: [...list, ...this.data.recommend] });
      }
    } catch (e) {}
  },

  async loadSeckill() {
    try {
      const list = await request('getSeckillList', {});
      this.setData({
        seckillList: (list || []).filter(s => s.state === 'ongoing').slice(0, 6)
      });
    } catch (e) {}
  },

  // ============ 跳转 ============
  goSearch() { nav.to('/pages/search/search'); },

  onIconTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/goods/goods?category=${id}` });
  },

  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.url) {
      wx.navigateTo({ url: `/pages/goods/goods?banner=${item.id}` });
    }
  },

  onNoticeTap() {
    wx.navigateTo({ url: '/package-cms/pages/cms/notice/notice' });
  },

  // 个性定制
  goCustom() {
    nav.to('/package-promo/pages/service/custom/custom');
  },

  // 秒杀
  goSeckill() { nav.to('/pages/seckill/seckill'); },
  onSeckillTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}&activity=seckill` });
  },

  // 推荐商品
  goList() { nav.to('/pages/goods/goods'); },
  onGoodsTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) nav.to('/pages/detail/detail?id=' + id);
  },

  // 收藏
  onFav(e) {
    e.stopPropagation && e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    const list = this.data.recommend.map(g => {
      if (g._id === id) g.favored = !g.favored;
      return g;
    });
    this.setData({ recommend: list });
    request('addFavorite', { goodsId: id }, { loading: false, silent: true }).catch(() => {});
  },

  // 加购物车
  onAddCart(e) {
    e.stopPropagation && e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    request('addOrder', { type: 'cart', goodsId: id, count: 1 }, { loading: false, silent: true })
      .then(() => wx.showToast({ title: '已加入购物车', icon: 'success' }))
      .catch(() => wx.showToast({ title: '加入失败', icon: 'none' }));
  },

  // 底部双卡
  goMember() { nav.to('/pages/member/member'); },
  goNotice() {
    // 跳到购买须知页(或用 webview 显示)
    wx.navigateTo({ url: '/package-cms/pages/cms/page/page?key=birthday-notice' });
  },

  // 客服
  onCallPhone() {
    const phone = this.data.servicePhone;
    wx.showModal({
      title: '客服热线',
      content: phone,
      confirmText: '拨打',
      success: (r) => {
        if (r.confirm) {
          wx.makePhoneCall({ phoneNumber: phone, fail: () => {
            wx.showToast({ title: '拨打失败', icon: 'none' });
          }});
        }
      }
    });
  },

  onContactService() {
    // 进入客服会话(已有 ChatClient)
    // 真实项目: 调后端拿 sessionId, 然后跳聊天页
    request('getOrCreateSession', { type: 'service' }, { loading: false, silent: true })
      .then(r => {
        if (r && r.sessionId) {
          nav.to('/package-chat/pages/chat/session/session?sessionId=' + r.sessionId);
        } else {
          wx.showToast({ title: '客服繁忙,请稍后', icon: 'none' });
        }
      })
      .catch(() => wx.showToast({ title: '连接失败', icon: 'none' }));
  }
});
