const { request } = require('../../utils/request.js');
const { orderStatusMap } = require('../../utils/util.js');

Page({
  data: { order: null, statusMap: orderStatusMap },

  onLoad(options) {
    this.setData({ id: options.id });
    this.load();
  },

  async load() {
    try {
      const list = await request('getOrders', {}, { loading: false });
      const order = list.find(o => o._id === this.data.id);
      if (order) this.setData({ order });
    } catch (e) {}
  },

  copyOrderNo() {
    wx.setClipboardData({ data: this.data.order.orderNo });
  }
});
