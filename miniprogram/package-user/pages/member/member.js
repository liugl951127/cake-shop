const { request } = require('../../utils/request.js');

Page({
  data: { info: null },

  onShow() { this.load(); },

  async load() {
    try {
      const info = await request('getMemberInfo', {}, { loading: false });
      this.setData({ info });
    } catch (e) {}
  },

  async onSignIn() {
    try {
      const r = await request('signIn', {});
      wx.showToast({ title: `签到成功 +${r.points} 积分` });
      this.load();
    } catch (e) {}
  }
});
