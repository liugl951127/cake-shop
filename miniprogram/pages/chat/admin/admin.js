const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');

Page({
  data: { list: [], loading: false, isOnline: true, filter: 'all' },

  onShow() { this.load(); this.watcher = this.startWatch(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },
  onUnload() { if (this.watcher) this.watcher.close(); },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f });
    this.load();
  },

  async toggleOnline() {
    const next = !this.data.isOnline;
    try {
      await request('setOnlineStatus', { isOnline: next });
      this.setData({ isOnline: next });
      wx.showToast({ title: next ? '已上线' : '已离线' });
    } catch (e) {}
  },

  async load() {
    this.setData({ loading: true });
    try {
      const where = {};
      if (this.data.filter === 'queue') where.status = 2;
      else if (this.data.filter === 'active') where.status = 1;
      const list = await request('adminGetSessions', where);
      this.setData({ list });
    } catch (e) {}
    this.setData({ loading: false });
  },

  // 实时订阅新会话
  startWatch() {
    return wx.cloud.database().collection('chatSessions')
      .where({ status: 1 })
      .watch({
        onChange: () => this.load(),
        onError: () => {}
      });
  },

  goSession(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({ url: `/pages/chat/adminChat/adminChat?sessionId=${item.sessionId}` });
  }
});
