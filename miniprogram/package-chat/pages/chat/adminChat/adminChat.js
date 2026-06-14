const { request } = require('../../../utils/request.js');
const { getUser } = require('../../../utils/auth.js');
const { formatTime } = require('../../../utils/util.js');
const { ChatClient } = require('../../../utils/chatClient.js');

const STATE_MAP = {
  idle: { text: '未连接', sub: '', cls: 'closed' },
  connecting: { text: '连接中...', sub: '', cls: 'queue' },
  connected: { text: '已连接', sub: '', cls: 'connected' },
  reconnecting: { text: '正在重连...', sub: '', cls: 'reconnecting' },
  closed: { text: '会话已结束', sub: '', cls: 'closed' }
};

Page({
  data: {
    session: null,
    messages: [],
    inputText: '',
    userInfo: {},
    userName: '',
    lastMessageId: '',
    state: 'idle',
    stateText: '未连接',
    stateSub: '',
    stateClass: 'closed',
    peerTyping: false
  },

  client: null,

  onLoad(options) {
    this.setData({ userInfo: getUser() });
    this._initClient(options.sessionId);
  },

  onShow() {
    if (this.client && this.client.getState() === 'reconnecting') this.client.onAppShow();
  },

  onUnload() {
    if (this.client) this.client.onUnload('unload');
  },

  onAppHide() {
    if (this.client) this.client.onAppHide();
  },

  onAppShow() {
    if (this.client) this.client.onAppShow();
  },

  _initClient(sessionId) {
    this.client = new ChatClient({
      role: 'admin',
      onState: (state) => {
        const info = STATE_MAP[state] || STATE_MAP.idle;
        this.setData({ state, stateText: info.text, stateSub: info.sub, stateClass: info.cls });
      },
      onMessage: (msg) => {
        this.setData({
          messages: [...this.data.messages, { ...msg, timeText: formatTime(new Date(msg.createTime), 'HH:mm') }],
          lastMessageId: `msg-${msg.messageId}`
        });
        request('getChatMessages', {
          sessionId: this.data.session.sessionId, markRead: true
        }, { loading: false, silent: true }).catch(() => {});
      },
      onPeerStateChange: () => {},
      onSessionUpdate: (s) => {
        this.setData({ session: s });
        if (s.status === 3) {
          wx.showModal({
            title: '会话已结束',
            content: s.closeReason || '',
            showCancel: false,
            success: () => wx.navigateBack()
          });
        }
      },
      onTyping: (typing) => this.setData({ peerTyping: typing })
    });

    this.client.start(sessionId).then(async (session) => {
      if (!session) {
        wx.showToast({ title: '会话不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1000);
        return;
      }
      this.setData({ session, userName: session.userNickName || '用户' });
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

  onTransfer() {
    if (!this.data.sessionId) return wx.showToast({ title: '会话未加载', icon: 'none' });
    nav.to('/package-chat/pages/chat/transfer/transfer?sessionId=' + this.data.sessionId + '&tab=skill');
  },

  onInvite() {
    if (!this.data.sessionId) return wx.showToast({ title: '会话未加载', icon: 'none' });
    nav.to('/package-chat/pages/chat/transfer/transfer?sessionId=' + this.data.sessionId + '&tab=triage');
  },

  async onSend() {
    const text = this.data.inputText.trim();
    if (!text) return;
    this.setData({ inputText: '' });
    try {
      const msg = await this.client.sendMessage(text);
      this.setData({
        messages: [...this.data.messages, {
          ...msg, fromType: 'admin', type: 'text', content: text,
          timeText: formatTime(new Date(msg.createTime), 'HH:mm')
        }],
        lastMessageId: `msg-${msg.messageId}`
      });
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  }
});
