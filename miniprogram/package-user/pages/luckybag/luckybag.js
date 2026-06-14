const { request } = require('../../../utils/request.js');
const { formatTime } = require('../../../utils/util.js');

Page({
  data: {
    stock: 0,
    prizes: [],
    drawing: false,
    result: null,
    myRecords: []
  },

  onShow() { this.load(); },

  async load() {
    try {
      const r = await request('luckyBag', { activityId: 'default' }, { loading: false, silent: true });
      // 演示模式: 拉取预设奖品池
      this.setData({
        stock: r.stockRemain !== undefined ? r.stockRemain : 200,
        prizes: r.prizes || [
          { name: '蛋糕券 50', weight: 5, image: '🎂' },
          { name: '蛋糕券 20', weight: 10, image: '🍰' },
          { name: '满减券', weight: 20, image: '🎟️' },
          { name: '100 积分', weight: 30, image: '💎' },
          { name: '50 积分', weight: 30, image: '⭐' },
          { name: '谢谢参与', weight: 5, image: '😢' }
        ],
        myRecords: r.myRecords || []
      });
    } catch (e) {}
  },

  async onDraw() {
    if (this.data.drawing) return;
    this.setData({ drawing: true, result: null });

    // 演示: 不真扣款,直接抽
    setTimeout(() => {
      const prizes = this.data.prizes;
      const total = prizes.reduce((s, p) => s + p.weight, 0);
      let r = Math.random() * total;
      let hit = prizes[0];
      for (const p of prizes) {
        if (r < p.weight) { hit = p; break; }
        r -= p.weight;
      }
      const isWin = hit.value > 0 || hit.name !== '谢谢参与';
      this.setData({
        drawing: false,
        result: { prize: hit, isWin }
      });
      if (isWin) wx.vibrateShort({ type: 'heavy' });
    }, 1200);
  },

  reset() {
    this.setData({ result: null });
  },

  goUse() {
    if (this.data.result && this.data.result.prize.type === 'coupon') {
      nav.to('/pages/coupon/center/center');
    } else {
      wx.showToast({ title: '已到账,请在"我的-积分"查看' });
    }
  }
});
