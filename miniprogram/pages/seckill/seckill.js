const { request } = require('../../utils/request.js');
const { formatCountdown } = require('../../utils/util.js');

Page({
  data: {
    list: [], now: Date.now(), loading: false, nowText: ''
  },

  onLoad() {
    this.tick();
    this._timer = setInterval(() => this.tick(), 1000);
  },

  onUnload() { if (this._timer) clearInterval(this._timer); },
  onShow() { this.load(); },

  tick() {
    const now = Date.now();
    const d = new Date(now);
    const pad = n => String(n).padStart(2, '0');
    this.setData({
      now,
      nowText: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      list: this.data.list.map(it => ({ ...it, countdown: formatCountdown(it.startTime - now) }))
    });
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await request('getSeckillList', {});
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  goSeckill(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '即将跳转商品详情',
      content: '秒杀商品将自动以秒杀价加入结算',
      success: (r) => {
        if (r.confirm) {
          // 实际项目:跳到结算页,标记 activityType=seckill
          wx.navigateTo({ url: `/pages/detail/detail?id=${id}&activity=seckill` });
        }
      }
    });
  }
});
