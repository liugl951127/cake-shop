// 邀请有礼
const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');

Page({
  data: {
    inviteCode: '',
    stats: {},
    showPoster: false,
    posterUrl: ''
  },

  onShow() { this.load(); },

  load() {
    const u = getUser();
    this.setData({ inviteCode: u.inviteCode || '...' });
    request('getInviteStats', {}, { loading: false, silent: true })
      .then((s) => this.setData({ stats: s || {} }))
      .catch(() => {});
  },

  onCopy() {
    if (!this.data.inviteCode) return;
    wx.setClipboardData({ data: this.data.inviteCode });
  },

  onShareAppMessage() {
    const code = this.data.inviteCode;
    return {
      title: '🎁 我在用甜心蛋糕,邀请你一起得积分!',
      path: '/pages/index/index?inviter=' + code,
      imageUrl: ''
    };
  },

  onShareTimeline() {
    return {
      title: '🎁 甜心蛋糕,邀请你得积分!',
      query: 'inviter=' + this.data.inviteCode
    };
  },

  // 生成海报(云函数画图,此处简化为占位)
  onShowPoster() {
    if (!this.data.inviteCode) return wx.showToast({ title: '请先登录', icon: 'none' });
    // 实际项目中调 wxacode.getUnlimited + 海报合成
    this.setData({
      posterUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=inviter%3D' + this.data.inviteCode,
      showPoster: true
    });
  },

  onClosePoster() { this.setData({ showPoster: false }); }
});
