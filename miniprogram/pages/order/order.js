const { request } = require('../../utils/request.js');
const { requireLogin } = require('../../utils/auth.js');
const cartUtil = require('../../utils/cart.js');
const { formatPrice } = require('../../utils/util.js');

Page({
  data: {
    from: 'cart',
    items: [],
    address: null,
    remark: '',
    goodsPrice: '0.00',
    freight: '0.00',
    discount: 0,
    totalPrice: '0.00',
    timeRanges: [],
    timeIndex: [0, 0],
    timeText: '尽快送达',
    payLoading: false,
    orderId: '',
    expireTime: 0,
    countdownText: ''
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

  onUnload() {
    if (this._timer) clearInterval(this._timer);
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
      const list = await request('getAddress', {}, { loading: false, silent: true });
      const def = list.find(a => a.isDefault) || list[0];
      if (def) this.setAddress(def);
    } catch (e) {}
  },

  setAddress(addr) { this.setData({ address: addr }); },

  selectAddress() { wx.navigateTo({ url: '/pages/address/list/list?select=1' }); },

  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },

  onTimeChange(e) { this.setData({ timeIndex: e.detail.value }); },

  async submitOrder() {
    if (!this.data.address) return wx.showToast({ title: '请选择地址', icon: 'none' });
    if (!requireLogin()) return;

    const items = this.data.items.map(i => ({
      _id: i._id, name: i.name, image: i.image,
      price: i.price, count: i.count, spec: i.spec
    }));
    const timeText = this.data.timeRanges[0][this.data.timeIndex[0]] + ' ' +
                     this.data.timeRanges[1][this.data.timeIndex[1]];

    this.setData({ payLoading: true });
    wx.showLoading({ title: '正在下单', mask: true });

    try {
      const result = await request('addOrder', {
        items,
        address: this.data.address,
        remark: this.data.remark,
        timeText,
        goodsPrice: this.data.goodsPrice,
        freight: this.data.freight,
        totalPrice: this.data.totalPrice
      }, { loading: false });

      this.setData({ orderId: result._id, expireTime: result.expireTime });

      // 清理临时数据
      if (this.data.from === 'cart') {
        const remain = cartUtil.get().filter(i => !items.find(it => it._id === i._id));
        cartUtil.save(remain);
      } else {
        wx.removeStorageSync('buyNow');
      }

      wx.hideLoading();
      // 调起微信支付
      this.invokePay(result.payment, result._id);
    } catch (e) {
      wx.hideLoading();
      this.setData({ payLoading: false });
    }
  },

  // 调起微信支付
  invokePay(payment, orderId) {
    if (!payment) {
      // 演示模式:payment 可能是 null,直接跳转订单页
      return this.skipPay(orderId);
    }

    wx.requestPayment({
      ...payment,
      success: () => {
        wx.showToast({ title: '支付成功' });
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` });
        }, 1000);
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          wx.showModal({
            title: '支付已取消',
            content: '订单将在 30 分钟后自动关闭,可在订单列表继续支付',
            confirmText: '去支付',
            cancelText: '查看订单',
            success: (r) => {
              if (r.confirm) {
                this.retryPay(orderId);
              } else {
                wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` });
              }
            }
          });
        } else {
          wx.showToast({ title: '支付失败', icon: 'none' });
        }
      },
      complete: () => this.setData({ payLoading: false })
    });
  },

  // 演示模式:直接跳详情
  skipPay(orderId) {
    wx.showToast({ title: '下单成功' });
    setTimeout(() => {
      wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` });
    }, 1000);
  },

  // 继续支付
  async retryPay(orderId) {
    try {
      const result = await request('getOrderDetail', { id: orderId });
      // 真实支付模式:再走统一下单
      // 此处简化,直接到详情页让用户从订单列表支付
      wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` });
    } catch (e) {}
  }
});
