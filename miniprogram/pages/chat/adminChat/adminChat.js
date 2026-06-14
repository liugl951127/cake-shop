const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { formatTime } = require('../../../utils/util.js');

Page({
  data: { sessionId: '', messages: [], inputText: '', userInfo: {}, userName: '', lastMessageId: '' },

  watcher: null,

  onLoad(options) {
    this.setData({ sessionId: options.sessionId, userInfo: getUser() });
    this.loadHistory();
    this.watcher = this.startWatch();
  },

  onUnload() { if (this.watcher) this.watcher.close(); },

  async loadHistory() {
    try {
      const list = await request('getChatMessages', {
        sessionId: this.data.sessionId,
        markRead: true
      }, { loading: false });
      const messages = list.map(m => ({
        ...m,
        timeText: formatTime(new Date(m.createTime), 'HH:mm')
      }));
      // 查会话信息
      const sessions = await request('adminGetSessions', { onlyMine: true });
      const session = sessions.find(s => s.sessionId === this.data.sessionId);
      this.setData({
        messages,
        userName: session ? (session.userNickName || '用户') : '用户',
        lastMessageId: messages.length ? `msg-${messages[messages.length - 1].messageId}` : ''
      });
    } catch (e) {}
  },

  startWatch() {
    return wx.cloud.database().collection('chatMessages')
      .where({ sessionId: this.data.sessionId })
      .watch({
        onChange: () => this.loadHistory(),
        onError: () => {}
      });
  },

  onInput(e) { this.setData({ inputText: e.detail.value }); },

  async onSend() {
    const text = this.data.inputText.trim();
    if (!text) return;
    this.setData({ inputText: '' });
    try {
      await request('sendChatMessage', {
        sessionId: this.data.sessionId,
        type: 'text',
        content: text
      });
      this.loadHistory();
    } catch (e) {}
  },

  async onClose() {
    const r = await wx.showModal({ title: '提示', content: '结束此会话?' });
    if (!r.confirm) return;
    try {
      await request('closeChatSession', { sessionId: this.data.sessionId, reason: '客服结束' });
      wx.navigateBack();
    } catch (e) {}
  }
});
