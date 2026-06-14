// 客服会话页 - 通过云开发 db.watch() 实时订阅消息
const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { formatTime } = require('../../../utils/util.js');

Page({
  data: {
    session: null,
    messages: [],
    inputText: '',
    userInfo: {},
    lastMessageId: '',
    keyboardHeight: 0
  },

  watcher: null,
  db: null,

  onLoad() {
    this.setData({ userInfo: getUser() });
    this.initSession();
    wx.onKeyboardHeightChange(res => {
      this.setData({ keyboardHeight: res.height * 2 });
    });
  },

  onUnload() {
    if (this.watcher) this.watcher.close();
  },

  async initSession() {
    try {
      const session = await request('getOrCreateSession', {});
      this.setData({ session });
      // 拉历史
      await this.loadHistory();
      // 启动实时订阅
      this.startWatch();
    } catch (e) {}
  },

  async loadHistory() {
    if (!this.data.session) return;
    const list = await request('getChatMessages', {
      sessionId: this.data.session.sessionId,
      markRead: true
    }, { loading: false });
    const messages = list.map(m => ({
      ...m,
      timeText: formatTime(new Date(m.createTime), 'HH:mm')
    }));
    this.setData({
      messages,
      lastMessageId: messages.length ? `msg-${messages[messages.length - 1].messageId}` : ''
    });
  },

  // 实时订阅新消息
  startWatch() {
    if (!this.data.session) return;
    const sid = this.data.session.sessionId;
    // 实时监听 messages 表
    this.watcher = wx.cloud.database().collection('chatMessages')
      .where({ sessionId: sid })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docChanges && snapshot.docChanges.length > 0) {
            this.loadHistory();
          }
        },
        onError: (err) => {
          console.error('watch error:', err);
        }
      });
  },

  onInput(e) { this.setData({ inputText: e.detail.value }); },

  async onSend() {
    const text = this.data.inputText.trim();
    if (!text || !this.data.session) return;
    this.setData({ inputText: '' });
    try {
      await request('sendChatMessage', {
        sessionId: this.data.session.sessionId,
        type: 'text',
        content: text
      });
      // 乐观更新 - 立即插入本地
      const now = Date.now();
      const tempMsg = {
        messageId: `temp-${now}`,
        sessionId: this.data.session.sessionId,
        fromType: 'user',
        type: 'text',
        content: text,
        timeText: formatTime(new Date(now), 'HH:mm'),
        _sending: true
      };
      this.setData({
        messages: [...this.data.messages, tempMsg],
        lastMessageId: `msg-${tempMsg.messageId}`
      });
      // 1 秒后由 watch 触发刷新,去掉临时态
      setTimeout(() => this.loadHistory(), 1000);
    } catch (e) {}
  },

  async onClose() {
    const r = await wx.showModal({ title: '提示', content: '结束当前会话?' });
    if (!r.confirm) return;
    try {
      await request('closeChatSession', { sessionId: this.data.session.sessionId });
      wx.navigateBack();
    } catch (e) {}
  }
});
