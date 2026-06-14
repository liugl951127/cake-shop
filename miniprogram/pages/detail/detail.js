const { request } = require('../../utils/request.js');
const { requireLogin, getUser } = require('../../utils/auth.js');
const cart = require('../../utils/cart.js');

Page({
  data: {
    id: '',
    goods: null,
    showSpec: false,
    count: 1,
    selectedSpecs: {},
    selectedSpec: '',
    address: null,
    addressText: '',
    favored: false,
    freightText: '免运费',
    recommendList: []
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail();
    this.loadRecommend();
    // 上报浏览埋点
    request('trackBehavior', { action: 'view', goodsId: options.id }, { loading: false, silent: true });
  },

  onShow() {
    const addr = wx.getStorageSync('selectAddress');
    if (addr) this.setAddress(addr);
  },

  async loadDetail() {
    try {
      const data = await request('getGoodsDetail', { id: this.data.id });
      this.setData({ goods: data });
      wx.setNavigationBarTitle({ title: data.name });
      this.checkFavor();
    } catch (e) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },

  async checkFavor() {
    if (!requireLogin()) return;
    try {
      const list = await request('getFavorites', {}, { loading: false });
      this.setData({ favored: list.some(i => i._id === this.data.id) });
    } catch (e) {}
  },

  async loadRecommend() {
    try {
      const list = await request('getRecommend', {
        goodsId: this.data.id,
        pageSize: 6
      }, { loading: false, silent: true });
      this.setData({ recommendList: list });
    } catch (e) {}
  },

  openSpec() {
    this.setData({ showSpec: true });
  },

  closeSpec() {
    this.setData({ showSpec: false });
  },

  selectSpec(e) {
    const { group, opt } = e.currentTarget.dataset;
    const selectedSpecs = { ...this.data.selectedSpecs, [group]: opt };
    const selectedSpec = Object.values(selectedSpecs).join(' / ');
    this.setData({ selectedSpecs, selectedSpec });
  },

  changeCount(e) {
    let count = this.data.count + Number(e.currentTarget.dataset.delta);
    if (count < 1) count = 1;
    if (this.data.goods && count > this.data.goods.stock) count = this.data.goods.stock;
    this.setData({ count });
  },

  onAddCart() {
    const g = this.data.goods;
    if (g.specs && g.specs.length && !this.data.selectedSpec) {
      return wx.showToast({ title: '请选择规格', icon: 'none' });
    }
    cart.add({ ...g, spec: this.data.selectedSpec }, this.data.count);
    this.setData({ showSpec: false });
    wx.showToast({ title: '已加入购物车' });
  },

  onBuyNow() {
    const g = this.data.goods;
    if (g.specs && g.specs.length && !this.data.selectedSpec) {
      return wx.showToast({ title: '请选择规格', icon: 'none' });
    }
    const item = { ...g, count: this.data.count, spec: this.data.selectedSpec };
    wx.setStorageSync('buyNow', item);
    nav.to('/pages/order/order?from=buynow');
  },

  goHome() { nav.tab('/pages/index/index'); },
  goCart() { nav.tab('/pages/cart/cart'); },
  goAddress() { nav.to('/pages/address/list/list?select=1'); },

  setAddress(addr) {
    const addressText = `${addr.name} ${addr.phone} ${addr.region} ${addr.detail}`;
    this.setData({ address, addressText });
  },

  async toggleFavor() {
    if (!requireLogin()) return;
    if (this.data.favored) {
      await request('removeFavorite', { id: this.data.id }, { loading: false });
      this.setData({ favored: false });
      wx.showToast({ title: '已取消收藏' });
    } else {
      await request('addFavorite', { id: this.data.id });
      this.setData({ favored: true });
      wx.showToast({ title: '已收藏' });
    }
  }
});
