const { request } = require('../../utils/request.js');
const { formatCountdown } = require('../../utils/util.js');

Page({
  data: { info: null, countdown: '', emptySlots: [] },

  onLoad(options) {
    this.setData({ groupId: options.groupId || '', goodsId: options.goodsId });
    this.load();
  },

  onShow() { this.load(); },
  onUnload() { if (this._timer) clearInterval(this._timer); },

  async load() {
    if (!this.data.groupId) {
      // 没传 groupId,自己开团
      const goodsId = this.data.goodsId;
      try {
        const r = await request('createGroup', { goodsId });
        this.setData({ groupId: r.groupId });
      } catch (e) { return; }
    }
    try {
      const info = await request('getGroupInfo', { groupId: this.data.groupId });
      const emptySlots = Array.from({ length: Math.max(0, info.groupSize - info.currentSize) });
      this.setData({ info, emptySlots });
      this.startCountdown();
    } catch (e) {}
  },

  startCountdown() {
    if (this._timer) clearInterval(this._timer);
    const tick = () => {
      if (!this.data.info) return;
      this.setData({ countdown: formatCountdown(this.data.info.remainMs) });
    };
    tick();
    this._timer = setInterval(tick, 1000);
  },

  async onJoinGroup() {
    // 简化:直接创建新订单
    const info = this.data.info;
    const order = await request('addOrder', {
      items: [{
        _id: info.goodsId, name: info.goodsName, image: info.goodsImage,
        price: info.groupPrice, count: 1, activityType: 'group'
      }],
      address: { name: '参团人', phone: '13800138000', region: '上海市 黄浦区', detail: '某某路 100 号' },
      goodsPrice: info.groupPrice, freight: 0, totalPrice: info.groupPrice,
      remark: `拼团活动,团 ID: ${info.groupId}`
    }).catch(e => null);
    if (!order) return;
    // 关联订单到团
    await request('joinGroup', { groupId: info.groupId, orderId: order._id });
    wx.showToast({ title: '已加入团,去支付' });
    setTimeout(() => wx.redirectTo({ url: `/pages/order/detail/detail?id=${order._id}` }), 1000);
  },

  goDetail() {
    wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.info.goodsId}` });
  }
});
