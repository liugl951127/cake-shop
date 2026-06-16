// 会员中心
const { request } = require('../../../utils/request.js');
const nav = require('../../../utils/nav');

Page({
  data: {
    user: null,
    levels: [],
    benefits: [],
    growthPercent: 0,
    nextLevelName: ''
  },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    try {
      const r = await request('getMemberCenter', {});
      // 预处理 levels: discountText (避免模板里 toFixed)
      const levels = (r.levels || []).map(lv => {
        const discount = lv.discount || 1;
        return Object.assign({}, lv, {
          discountText: discount < 1
            ? ((1 - discount) * 10).toFixed(0) + ' 折优惠'
            : '基础权益'
        });
      });
      this.setData({
        user: r.user || null,
        levels,
        benefits: r.benefits || [],
        growthPercent: r.growthPercent || 0,
        nextLevelName: r.nextLevelName || ''
      });
    } catch (e) {
      console.warn('member load err:', e);
    }
  },

  goGrowth() { nav.to('/package-user/pages/member/growth/growth'); },
  goCoupon() { nav.to('/package-user/pages/coupon/center/center'); }
});
