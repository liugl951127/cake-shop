const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { ChatClient } = require('../../../utils/chatClient.js');

Page({
  data: { list: [], loading: false, isOnline: true, filter: 'all' },

  client: null,

  onShow() {
    this.load();
    this._initPresence();
  },

  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },
  onUnload() {
    if (this.client) this.client.onUnload('hide');
  },
  onAppHide() { if (this.client) this.client.onAppHide(); },
  onAppShow() { if (this.client) this.client.onAppShow(); },

  // 客服端 presence(不绑定具体 session,只保活)
  _initPresence() {
    this.client = new ChatClient({
      role: 'admin',
      onState: () => {},
      onMessage: () => {},
      onPeerStateChange: () => {},
      onSessionUpdate: () => {},
      onTyping: () => {}
    });
    // 客服列表页不需要绑定具体 session,只保持心跳
    this.client.start().catch(() => {});
  },

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
      if (!next && this.client) this.client.onUnload('hide');
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

  goSession(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({ url: `/pages/chat/adminChat/adminChat?sessionId=${item.sessionId}` });
  }
});
