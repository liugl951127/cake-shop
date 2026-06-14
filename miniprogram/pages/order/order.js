const { request } = require('../../utils/request.js');
const { requireLogin } = require('../../utils/auth.js');
const cartUtil = require('../../utils/cart.js');
const { formatPrice } = require('../../utils/util.js');

Page({
  data: {
    from: 'cart', // cart | buynow
    items: [],
    address: null,
    remark: '',
    goodsPrice: '0.00',
    freight: '0.00',
    discount: 0,
    totalPrice: '0.00',
    timeRanges: [],
    timeIndex: [0, 0],
    timeText: '尽快送达'
  },

  onLoad(options) {
    this.setData({ from: options.from || 'cart' });
    this.buildTimeOptions();
    this.loadItems();
  },

  onShow() {
    const addr = wx.getStorageSync('selectAddress');
    if (addr) this.setAddress(addr);
  },

  buildTimeOptions() {
    const dates = [];
    const times = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const label = i === 0 ? '今天' : i === 1 ? '明天' : '后天';
      dates.push(`${label} (${d.getMonth() + 1}/${d.getDate()})`);
    }
    for (let h = 9; h < 22; h++) {
      times.push(`${h}:00 - ${h + 1}:00`);
    }
    this.setData({ timeRanges: [dates, times] });
  },

  loadItems() {
    let items = [];
    if (this.data.from === 'buynow') {
      items = [wx.getStorageSync('buyNow')].filter(Boolean);
    } else {
      items = wx.getStorageSync('checkoutItems') || [];
    }
    if (items.length === 0) {
      wx.showToast({ title: '订单为空', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ items });
    this.compute();
    this.loadDefaultAddress();
  },

  compute() {
    const goodsPrice = this.data.items.reduce((s, i) => s + i.price * i.count, 0);
    const freight = goodsPrice >= 99 ? 0 : 8;
    const totalPrice = goodsPrice + freight - this.data.discount;
    this.setData({
      goodsPrice: formatPrice(goodsPrice),
      freight: formatPrice(freight),
      totalPrice: formatPrice(totalPrice)
    });
  },

  async loadDefaultAddress() {
    try {
      const list = await request('getAddress', {}, { loading: false });
      const def = list.find(a => a.isDefault) || list[0];
      if (def) this.setAddress(def);
    } catch (e) {}
  },

  setAddress(addr) {
    this.setData({ address: addr });
  },

  selectAddress() {
    wx.navigateTo({ url: '/pages/address/list/list?select=1' });
  },

  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },

  onTimeChange(e) { this.setData({ timeIndex: e.detail.value }); },

  async submitOrder() {
    if (!this.data.address) return wx.showToast({ title: '请选择地址', icon: 'none' });
    if (!requireLogin()) return;
    wx.showLoading({ title: '提交中', mask: true });
    try {
      const items = this.data.items.map(i => ({
        _id: i._id, name: i.name, image: i.image, price: i.price,
        count: i.count, spec: i.spec
      }));
      const timeText = this.data.timeRanges[0][this.data.timeIndex[0]] + ' ' +
                       this.data.timeRanges[1][this.data.timeIndex[1]];

      const order = await request('addOrder', {
        items,
        address: this.data.address,
        remark: this.data.remark,
        timeText,
        goodsPrice: this.data.goodsPrice,
        freight: this.data.freight,
        totalPrice: this.data.totalPrice
      });

      // 清理临时数据
      if (this.data.from === 'cart') {
        const remain = cartUtil.get().filter(i => !items.find(it => it._id === i._id));
        cartUtil.save(remain);
      } else {
        wx.removeStorageSync('buyNow');
      }

      wx.hideLoading();
      this.pay(order);
    } catch (e) {
      wx.hideLoading();
    }
  },

  pay(order) {
    wx.showLoading({ title: '调起支付', mask: true });
    // 真实云开发支付示例,需要商户号开通
    // 此处演示用订阅消息 + 标记已支付来跑通流程
    request('payCallback', { orderId: order._id, payResult: 'success' })
      .then(() => {
        wx.hideLoading();
        wx.showModal({
          title: '下单成功',
          content: '支付已完成(演示模式,真实环境将调起微信支付)',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/order/list/list' });
          }
        });
      })
      .catch(() => wx.hideLoading());
  }
});
