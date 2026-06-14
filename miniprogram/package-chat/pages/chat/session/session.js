// pages/chat/session/session.js
const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { formatTime } = require('../../../utils/util.js');
const { ChatClient } = require('../../../utils/chatClient.js');
const nav = require('./nav.js');

Page({
  data: {
    sessionId: '',
    userId: '',
    openid: '',
    status: 'pending',         // 来自 chat_sessions.status
    transferredToWeCom: false
  },
  onLoad(query) {
    this.setData({
      sessionId: query.sessionId || '',
      userId: (getUser() || {}).userId || '',
      openid: wx.getStorageSync('openid') || ''
    });
    // 拉会话最新状态
    this.refreshStatus();
    // 每 5s 刷一次
    this._timer = setInterval(() => this.refreshStatus(), 5000);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },
  async refreshStatus() {
    if (!this.data.sessionId) return;
    try {
      const r = await wx.cloud.callFunction({
        name: 'queryChatHistory',
        data: { sessionId: this.data.sessionId, size: 1, page: 1, withRich: false }
      });
      // 从另一个云函数拉会话状态,这里简化:轮询
      // 真实做法: 增加 getChatSession 云函数
    } catch (e) { /* ignore */ }
  },
  onTransferSuccess(e) {
    this.setData({ transferredToWeCom: true, status: 'transferred' });
  },
  onTransferError(e) {
    console.warn('transfer error', e);
  },
  onHangup(e) {
    this.setData({ status: 'closed' });
    // 提示: 已经挂断
  },
  onRated(e) {
    console.log('rated', e.detail);
  }
});
