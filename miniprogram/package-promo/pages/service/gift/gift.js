// 送礼服务
const { request } = require('../../../../utils/request.js');
const nav = require('../../../../utils/nav.js');

Page({
  data: {
    form: { phone: '', name: '', message: '', anonymous: true, deliverDate: '' },
    picked: {},
    today: ''
  },

  onLoad() {
    this.setData({ today: new Date().toISOString().slice(0, 10) });
  },

  onK(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value }); },
  onDate(e) { this.setData({ 'form.deliverDate': e.detail.value }); },
  toggleAnon() { this.setData({ 'form.anonymous': !this.data.form.anonymous }); },

  onPickGoods() {
    nav.to('/pages/goods/goods');
    wx.setStorageSync('__pick_for_gift__', true);
  },

  onSubmit() {
    if (!/^1\d{10}$/.test(this.data.form.phone)) {
      return wx.showToast({ title: '请填手机号', icon: 'none' });
    }
    if (!this.data.form.message) return wx.showToast({ title: '请填贺卡', icon: 'none' });
    if (!this.data.picked._id) return wx.showToast({ title: '请选商品', icon: 'none' });
    wx.showLoading({ title: '送礼中' });
    // 直接创建订单 + 标记为礼物
    request('addOrder', {
      items: [{ goodsId: this.data.picked._id, name: this.data.picked.name, price: this.data.picked.price, image: this.data.picked.image, count: 1 }],
      address: { name: this.data.form.name || '收礼人', phone: this.data.form.phone, region: '', detail: '请收礼人确认地址' },
      remark: `[礼物] ${this.data.form.message}${this.data.form.anonymous ? ' [匿名]' : ''}`,
      isGift: true,
      giftMsg: this.data.form.message,
      goodsPrice: this.data.picked.price,
      freight: 0,
      totalPrice: this.data.picked.price
    }).then(() => {
      wx.hideLoading();
      wx.showModal({ title: '送礼成功', content: '心意已送达收礼人,可在订单详情查看进度', showCancel: false, success: () => nav.back() });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: err.msg || '失败', icon: 'none' });
    });
  }
});
