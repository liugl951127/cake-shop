const { request } = require('../../utils/request.js');
const { orderStatusMap } = require('../../utils/util.js');

Page({
  data: {
    order: null,
    statusMap: orderStatusMap,
    countdown: '',
    hasActions: false
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.load();
  },

  onShow() {
    if (this.data.order) this.startCountdown();
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  async load() {
    try {
      const order = await request('getOrderDetail', { id: this.data.id });
      const hasActions = [0, 1, 2, 3, 4, -1, -2].includes(order.status);
      this.setData({ order, hasActions });
      this.startCountdown();
    } catch (e) {}
  },

  // 倒计时
  startCountdown() {
    if (this._timer) clearInterval(this._timer);
    const o = this.data.order;
    if (!o || o.status !== 0 || !o.expireTime) return;

    const update = () => {
      const remain = Math.max(0, o.expireTime - Date.now());
      if (remain <= 0) {
        this.setData({ countdown: '00:00' });
        clearInterval(this._timer);
        this.load(); // 重新拉状态
        return;
      }
      const min = Math.floor(remain / 60000);
      const sec = Math.floor((remain % 60000) / 1000);
      this.setData({ countdown: `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` });
    };
    update();
    this._timer = setInterval(update, 1000);
  },

  copyOrderNo() {
    wx.setClipboardData({ data: this.data.order.orderNo });
    wx.showToast({ title: '已复制' });
  },

  callDelivery() {
    wx.makePhoneCall({ phoneNumber: this.data.order.deliveryInfo.phone });
  },

  // 继续支付
  onPay() {
    const o = this.data.order;
    if (o.payment) {
      // 真实支付: 调起支付
      // 此处简化,实际项目应再走一次统一下单拿 payment
      wx.showModal({ title: '继续支付', content: '请在小程序中重新发起支付' });
    } else {
      wx.showToast({ title: '订单已过期,请重新下单', icon: 'none' });
    }
  },

  // 取消订单
  async onCancel() {
    const r = await wx.showModal({ title: '提示', content: '确认取消订单?' });
    if (!r.confirm) return;
    try {
      await request('cancelOrder', { id: this.data.id });
      this.load();
    } catch (e) {}
  },

  // 确认收货
  async onConfirm() {
    const r = await wx.showModal({ title: '提示', content: '确认已收到商品?' });
    if (!r.confirm) return;
    try {
      await request('confirmReceive', { id: this.data.id });
      this.load();
    } catch (e) {}
  },

  // 申请退款
  async onRefund() {
    const r = await wx.showModal({
      title: '申请退款',
      content: '退款申请提交后将由商家处理,款项将原路退回',
      editable: true,
      placeholderText: '请输入退款原因'
    });
    if (!r.confirm) return;
    const reason = (r.content || '').trim() || '用户申请退款';
    try {
      await request('refund', { orderId: this.data.id, reason });
      wx.showToast({ title: '退款申请已提交' });
      this.load();
    } catch (e) {}
  },

  // 删除订单
  async onDelete() {
    const r = await wx.showModal({ title: '提示', content: '确认从列表中删除该订单?' });
    if (!r.confirm) return;
    try {
      await request('cancelOrder', { id: this.data.id, remove: true });
      wx.navigateBack();
    } catch (e) {}
  }
});
