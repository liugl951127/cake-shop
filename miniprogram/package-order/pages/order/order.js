const { request } = require('../../../utils/request.js');
const { requireLogin, getUser } = require('../../../utils/auth.js');
const cartUtil = require('../../../utils/cart.js');
const { formatPrice } = require('../../../utils/util.js');

Page({
  data: {
    from: 'cart',
    items: [],
    address: null,
    store: null,
    isSelfPickup: false,
    remark: '',
    timeRanges: [],
    timeIndex: [0, 0],
    timeText: '尽快送达',
    payLoading: false,
    orderId: '',
    expireTime: 0,
    countdownText: '',

    // 会员 / 优惠券 / 积分
    userInfo: {},
    memberDiscount: 0,
    availableCoupons: [],
    couponId: '',
    couponDiscount: 0,
    promoDiscount: 0,
    usePoints: 0,
    pointsDiscount: 0,

    goodsPrice: '0.00',
    freight: '0.00',
    totalPrice: '0.00'
  },

  onLoad(options) {
    this.setData({ from: options.from || 'cart' });
    this.buildTimeOptions();
    this.loadUserInfo();
    this.loadItems();
  },

  onShow() {
    const addr = wx.getStorageSync('selectAddress');
    if (addr) this.setAddress(addr);
    const store = wx.getStorageSync('selectStore');
    if (store) this.setStore(store);
  },

  onUnload() { if (this._timer) clearInterval(this._timer); },

  buildTimeOptions() {
    const dates = [];
    const times = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const label = i === 0 ? '今天' : i === 1 ? '明天' : '后天';
      dates.push(`${label} (${d.getMonth() + 1}/${d.getDate()})`);
    }
    for (let h = 9; h < 22; h++) times.push(`${h}:00 - ${h + 1}:00`);
    this.setData({ timeRanges: [dates, times] });
  },

  loadUserInfo() {
    const u = getUser();
    this.setData({ userInfo: u });
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
    this.loadCoupons();
  },

  compute() {
    const u = this.data.userInfo;
    const goodsPrice = this.data.items.reduce((s, i) => s + i.price * i.count, 0);

    // 会员折扣
    const lv = u.level || 0;
    const discountMap = { 0: 1, 1: 0.98, 2: 0.95, 3: 0.9 };
    const memberRate = discountMap[lv] || 1;
    const memberDiscount = Number((goodsPrice * (1 - memberRate)).toFixed(2));

    // 优惠券
    const couponDiscount = this.data.couponDiscount;

    // 积分抵扣
    const pointsDiscount = this.data.usePoints > 0 ? Number((this.data.usePoints / 100).toFixed(2)) : 0;

    // 运费(由 calcDelivery 计算,无坐标时 fallback)
    let freight = this.data.freight;
    if (this.data.isSelfPickup) freight = 0;
    if (freight === undefined || freight === null) {
      freight = goodsPrice >= 99 ? 0 : 8;
    }

    // 应付
    const promoDiscount = Number(this.data.promoDiscount || 0);
    const total = Math.max(0, goodsPrice - memberDiscount - couponDiscount - pointsDiscount - promoDiscount + freight);

    this.setData({
      goodsPrice: formatPrice(goodsPrice),
      memberDiscount: formatPrice(memberDiscount),
      couponDiscount: formatPrice(couponDiscount),
      pointsDiscount: formatPrice(pointsDiscount),
      freight: formatPrice(freight),
      totalPrice: formatPrice(total)
    });
  },

  async loadDefaultAddress() {
    try {
      const list = await request('getAddress', {}, { loading: false, silent: true });
      const def = list.find(a => a.isDefault) || list[0];
      if (def) this.setAddress(def);
    } catch (e) {}
  },

  async loadCoupons() {
    const goodsPrice = this.data.items.reduce((s, i) => s + i.price * i.count, 0);
    try {
      const [list, promos] = await Promise.all([
        request('getCoupons', { available: true, amount: goodsPrice }),
        request('getFullReduce', {}, { loading: false, silent: true })
      ]);
      let promoDiscount = 0;
      if (promos && promos.length) {
        for (const p of promos) {
          if (goodsPrice >= p.minAmount) {
            const d = Math.floor(goodsPrice / p.fullAmount) * p.reduceAmount;
            if (p.maxDiscount) promoDiscount = Math.max(promoDiscount, Math.min(d, p.maxDiscount));
            else promoDiscount = Math.max(promoDiscount, d);
          }
        }
      }
      this.setData({ availableCoupons: list, promoDiscount: promoDiscount.toFixed(2) });
      this.compute();
    } catch (e) {}
  },

  setAddress(addr) {
    this.setData({ address: addr });
    this.calcDelivery(addr);
  },

  async calcDelivery(addr) {
    // 有地址 lat/lng 则动态算
    if (!addr || addr.lat === undefined) return;
    try {
      const goodsPrice = this.data.items.reduce((s, i) => s + i.price * i.count, 0);
      const r = await request('calcDelivery', {
        fromLng: 116.404, fromLat: 39.915,  // 店坐标(演示)
        toLng: addr.lng, toLat: addr.lat,
        orderAmount: goodsPrice, type: 'auto'
      }, { loading: false, silent: true });
      this.setData({
        freight: r.fee,
        deliveryEta: r.eta,
        deliveryDistance: r.distance
      });
      this.calcTotal();
    } catch (e) {}
  },
  setStore(store) { this.setData({ store }); },

  selectAddress() { nav.to('/pages/address/list/list?select=1'); },
  selectStore() { nav.to('/pages/store/list/list'); },

  setPickup(e) {
    const v = e.currentTarget.dataset.v === 'true';
    this.setData({ isSelfPickup: v });
    this.compute();
  },

  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },
  onTimeChange(e) { this.setData({ timeIndex: e.detail.value }); },

  // 选优惠券
  showCouponPicker() {
    const items = ['不使用', ...this.data.availableCoupons.map(c => `${c.name} (-¥${c.discount})`)];
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ couponId: '', couponDiscount: 0 });
        } else {
          const c = this.data.availableCoupons[res.tapIndex - 1];
          this.setData({ couponId: c._id, couponDiscount: c.discount });
        }
        this.compute();
      }
    });
  },

  togglePoints(e) {
    const use = e.detail.value ? Math.min(100, this.data.userInfo.points || 0) : 0;
    this.setData({ usePoints: use });
    this.compute();
  },

  async submitOrder() {
    if (!this.data.isSelfPickup && !this.data.address) {
      return wx.showToast({ title: '请选择地址', icon: 'none' });
    }
    if (this.data.isSelfPickup && !this.data.store) {
      return wx.showToast({ title: '请选择自提门店', icon: 'none' });
    }
    if (!requireLogin()) return;

    const items = this.data.items.map(i => ({
      _id: i._id, name: i.name, image: i.image,
      price: i.price, count: i.count, spec: i.spec
    }));
    const timeText = this.data.isSelfPickup ? '门店自提' :
      (this.data.timeRanges[0][this.data.timeIndex[0]] + ' ' + this.data.timeRanges[1][this.data.timeIndex[1]]);

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
        totalPrice: this.data.totalPrice,
        couponId: this.data.couponId,
        couponDiscount: this.data.couponDiscount,
        usePoints: this.data.usePoints,
        isSelfPickup: this.data.isSelfPickup,
        storeId: this.data.store ? this.data.store._id : ''
      }, { loading: false });

      this.setData({ orderId: result._id, expireTime: result.expireTime });

      if (this.data.from === 'cart') {
        const remain = cartUtil.get().filter(i => !items.find(it => it._id === i._id));
        cartUtil.save(remain);
      } else {
        wx.removeStorageSync('buyNow');
      }

      wx.hideLoading();
      this.invokePay(result.payment, result._id);
    } catch (e) {
      wx.hideLoading();
      this.setData({ payLoading: false });
    }
  },

  invokePay(payment, orderId) {
    if (!payment) return this.skipPay(orderId);
    wx.requestPayment({
      ...payment,
      success: () => {
        wx.showToast({ title: '支付成功' });
        setTimeout(() => wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` }), 1000);
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          wx.showModal({
            title: '支付已取消',
            content: '订单将在 30 分钟后自动关闭',
            confirmText: '去支付',
            cancelText: '查看订单',
            success: (r) => {
              if (r.confirm) wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` });
              else wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` });
            }
          });
        }
      },
      complete: () => this.setData({ payLoading: false })
    });
  },

  skipPay(orderId) {
    wx.showToast({ title: '下单成功' });
    setTimeout(() => wx.redirectTo({ url: `/pages/order/detail/detail?id=${orderId}` }), 1000);
  }
});
