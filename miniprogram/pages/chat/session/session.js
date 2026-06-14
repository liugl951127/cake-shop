// 用户端客服会话页 - 接入 ChatClient(连接管理 + 心跳 + 重连)
const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { formatTime } = require('../../../utils/util.js');
const { ChatClient } = require('../../../utils/chatClient.js');

const STATE_MAP = {
  idle: { text: '未连接', sub: '', cls: 'closed' },
  connecting: { text: '正在连接...', sub: '', cls: 'queue' },
  connected: { text: '已连接', sub: '', cls: 'connected' },
  reconnecting: { text: '正在重连...', sub: '消息将在恢复后送达', cls: 'reconnecting' },
  closed: { text: '会话已结束', sub: '', cls: 'closed' }
};

Page({
  data: {
    session: null,
    messages: [],
    inputText: '',
    userInfo: {},
    lastMessageId: '',
    state: 'idle',
    stateText: '未连接',
    stateSub: '',
    stateClass: 'closed',
    peerTyping: false,
    peerTypingName: '',
    peerOnline: true
  },

  client: null,
  _appHideReported: false,

  onLoad() {
    this.setData({ userInfo: getUser() });
    this._initClient();
  },

  onShow() {
    if (this.client && this.client.getState() === 'reconnecting') {
      this.client.onAppShow();
    }
  },

  onUnload() {
    if (this.client) this.client.onUnload('unload');
  },

  onAppHide() {
    // 切后台
    if (this.client) this.client.onAppHide();
  },

  onAppShow() {
    if (this.client) this.client.onAppShow();
  },

  _initClient() {
    this.client = new ChatClient({
      role: 'user',
      onState: (state) => {
        const info = STATE_MAP[state] || STATE_MAP.idle;
        this.setData({
          state, stateText: info.text, stateSub: info.sub, stateClass: info.cls
        });
      },
      onMessage: (msg) => {
        this.setData({
          messages: [...this.data.messages, { ...msg, timeText: formatTime(new Date(msg.createTime), 'HH:mm') }],
          lastMessageId: `msg-${msg.messageId}`
        });
        // 标记已读
        request('getChatMessages', {
          sessionId: this.data.session.sessionId, markRead: true
        }, { loading: false, silent: true }).catch(() => {});
      },
      onPeerStateChange: (online) => {
        this.setData({ peerOnline: online });
      },
      onSessionUpdate: (s) => {
        this.setData({ session: s });
        if (s.status === 3) {
          wx.showModal({
            title: '会话已结束',
            content: s.closeReason || '会话已关闭',
            showCancel: false,
            success: () => wx.navigateBack()
          });
        }
      },
      onTyping: (typing) => {
        this.setData({ peerTyping: typing, peerTypingName: this.data.session ? (this.data.session.adminName || '客服') : '客服' });
      }
    });

    // 拉历史
    this.client.start().then(async (session) => {
      if (!session) return;
      this.setData({ session });
      const list = await request('getChatMessages', {
        sessionId: session.sessionId, markRead: true
      }, { loading: false, silent: true });
      this.setData({
        messages: list.map(m => ({ ...m, timeText: formatTime(new Date(m.createTime), 'HH:mm') })),
        lastMessageId: list.length ? `msg-${list[list.length-1].messageId}` : ''
      });
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
    if (this.client && e.detail.value) this.client.onInputTyping();
  },

  onFocus() {},

  async onSend() {
    const text = this.data.inputText.trim();
    if (!text) return;
    this.setData({ inputText: '' });
    try {
      const msg = await this.client.sendMessage(text);
      // 乐观插入
      const tempMsg = {
        ...msg, fromType: 'user', type: 'text', content: text,
        timeText: formatTime(new Date(msg.createTime), 'HH:mm'),
        messageId: msg.messageId
      };
      this.setData({
        messages: [...this.data.messages, tempMsg],
        lastMessageId: `msg-${msg.messageId}`
      });
    } catch (e) {
      wx.showToast({ title: '发送失败,请重试', icon: 'none' });
    }
  }
});
