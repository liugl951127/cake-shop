// 身份认证中心
const { request } = require('../../../utils/request.js');

const LEVEL_MAP = {
  full: { icon: '🏆', text: '高级认证' },
  high: { icon: '🥇', text: '实名 + 活体' },
  basic: { icon: '🥈', text: '已实名' },
  none: { icon: '🥉', text: '未认证' }
};

Page({
  data: {
    status: {
      realName: { verified: false, name: '' },
      liveness: { verified: false, score: 0 },
      bankCard: { verified: false, masked: '' }
    },
    level: 'none',
    levelIcon: '🥉',
    levelText: '未认证',
    unlocks: []
  },

  onShow() { this.load(); },

  async load() {
    try {
      const r = await request('getVerifyStatus', {}, { loading: false, silent: true });
      const lv = LEVEL_MAP[r.level] || LEVEL_MAP.none;
      this.setData({
        status: r,
        level: r.level,
        levelIcon: lv.icon,
        levelText: lv.text,
        unlocks: r.unlocks || []
      });
    } catch (e) {}
  },

  goRealName() {
    if (this.data.status.realName.verified) {
      return wx.showModal({ title: '已实名', content: `已认证: ${this.data.status.realName.name}`, showCancel: false });
    }
    wx.navigateTo({ url: '/package-user/pages/verify/realname/realname' });
  },

  goLiveness() {
    if (!this.data.status.realName.verified) {
      return wx.showToast({ title: '请先完成实名认证', icon: 'none' });
    }
    if (this.data.status.liveness.verified) {
      return wx.showModal({ title: '已通过', content: '已完成活体认证', showCancel: false });
    }
    wx.navigateTo({ url: '/package-user/pages/verify/liveness/liveness' });
  },

  goBank() {
    if (!this.data.status.realName.verified) {
      return wx.showToast({ title: '请先完成实名认证', icon: 'none' });
    }
    wx.navigateTo({ url: '/package-user/pages/verify/bank/bank' });
  }
});
