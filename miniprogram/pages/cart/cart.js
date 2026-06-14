const cartUtil = require('../../utils/cart.js');

Page({
  data: {
    list: [],
    allSelected: false,
    totalPrice: '0.00',
    selectedCount: 0
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const list = cartUtil.get().map(i => ({ ...i, selected: true }));
    this.compute(list);
  },

  compute(list) {
    const selected = list.filter(i => i.selected);
    const totalPrice = selected.reduce((s, i) => s + i.price * i.count, 0).toFixed(2);
    this.setData({
      list,
      allSelected: list.length > 0 && list.every(i => i.selected),
      totalPrice,
      selectedCount: selected.length
    });
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map(i => i._id === id ? { ...i, selected: !i.selected } : i);
    this.compute(list);
  },

  toggleAll() {
    const allSelected = !this.data.allSelected;
    const list = this.data.list.map(i => ({ ...i, selected: allSelected }));
    this.compute(list);
  },

  changeCount(e) {
    const { id, delta } = e.currentTarget.dataset;
    const item = this.data.list.find(i => i._id === id);
    cartUtil.update(id, item.count + Number(delta));
    this.refresh();
  },

  checkout() {
    const selected = this.data.list.filter(i => i.selected);
    if (selected.length === 0) return wx.showToast({ title: '请选择商品', icon: 'none' });
    wx.setStorageSync('checkoutItems', selected);
    nav.to('/pages/order/order?from=cart');
  },

  goShopping() {
    nav.tab('/pages/goods/goods');
  }
});
