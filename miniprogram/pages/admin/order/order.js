const { request } = require('../../../utils/request.js');
const { orderStatusMap } = require('../../../utils/util.js');

Page({
  data: {
    list: [], loading: false, status: '',
    statusMap: orderStatusMap,
    shipOrderId: '',
    shipForm: { name: '', phone: '', company: '', deliveryNo: '' }
  },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  switchTab(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ status: v });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('adminGetOrders', { status: this.data.status }, { loading: false });
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  async updateStatus(e) {
    const { id, v } = e.currentTarget.dataset;
    try {
      await request('adminUpdateOrder', { id, status: Number(v) });
      wx.showToast({ title: '已更新' });
      this.load();
    } catch (e) {}
  },

  openShip(e) {
    this.setData({
      shipOrderId: e.currentTarget.dataset.id,
      shipForm: { name: '', phone: '', company: '', deliveryNo: '' }
    });
  },

  closeShip() {
    this.setData({ shipOrderId: '' });
  },

  onShipI(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [`shipForm.${k}`]: e.detail.value });
  },

  async confirmShip() {
    const { name, phone, company, deliveryNo } = this.data.shipForm;
    if (!name) return wx.showToast({ title: '请填配送员姓名', icon: 'none' });
    if (!/^1\d{10}$/.test(phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });

    try {
      await request('adminShipOrder', {
        id: this.data.shipOrderId,
        name, phone, company, deliveryNo
      });
      wx.showToast({ title: '已发货' });
      this.closeShip();
      this.load();
    } catch (e) {}
  }
});
