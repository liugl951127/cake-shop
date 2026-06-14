// pages/chat/session/session.js (升级 v20+)
const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { formatTime } = require('../../../utils/util.js');
const { ChatClient } = require('../../../utils/chatClient.js');
const nav = require('./nav.js');

// 占位 - 文件原本很简单(由历史分包引入 nav.js 后改成纯跳转页)
Page({
  data: {
    sessionId: '',
    userId: '',
    openid: '',
    transferredToWeCom: false
  },
  onLoad(query) {
    this.setData({
      sessionId: query.sessionId || '',
      userId: (getUser() || {}).userId || '',
      openid: wx.getStorageSync('openid') || ''
    });
  },
  onTransferSuccess(e) {
    this.setData({ transferredToWeCom: true });
    wx.showToast({ title: '已转接', icon: 'success' });
  },
  onTransferError(e) {
    console.warn('transfer error', e);
  }
});
