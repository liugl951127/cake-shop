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

const RATE_TAGS = ['态度好', '回复快', '专业', '耐心', '解决了问题', '还需改进'];

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
    showRate: false,
    rateScore: 5,
    rateTags: [],
    rateComment: '',
    rateTagsOptions: RATE_TAGS
  },

  client: null,
  _endedShown: false,

  onLoad() {
    this.setData({ userInfo: getUser() });
    this._initClient();
  },

  onShow() {
    if (this.client && this.client.getState() === 'reconnecting') this.client.onAppShow();
  },
  onUnload() {
    if (this.client) this.client.onUnload('unload');
  },
  onAppHide() { if (this.client) this.client.onAppHide(); },
  onAppShow() { if (this.client) this.client.onAppShow(); },

  _initClient() {
    this.client = new ChatClient({
      role: 'user',
      onState: (state) => {
        const info = STATE_MAP[state] || STATE_MAP.idle;
        this.setData({ state, stateText: info.text, stateSub: info.sub, stateClass: info.cls });
      },
      onMessage: (msg) => this._onIncomingMessage(msg),
      onPeerStateChange: () => {},
      onSessionUpdate: (s) => this._onSessionUpdate(s),
      onTyping: (typing) => this.setData({
        peerTyping: typing,
        peerTypingName: this.data.session ? (this.data.session.adminName || '客服') : '客服'
      })
    });

    this.client.start().then(async (session) => {
      if (!session) return;
      this.setData({ session });
      await this._loadHistory();
    });
  },

  async _loadHistory() {
    if (!this.data.session) return;
    const list = await request('getChatMessages', {
      sessionId: this.data.session.sessionId, markRead: true
    }, { loading: false, silent: true });
    // 把 image/file 类型解析为 tempURL
    const ids = list.filter(m => m.type === 'image' || m.type === 'file').map(m => m.content);
    let urlMap = {};
    if (ids.length) {
      const res = await request('getTempFileURL', { fileIDs: ids }, { loading: false, silent: true });
      urlMap = (res || []).reduce((m, x) => { m[x.fileID] = x.tempFileURL; return m; }, {});
    }
    const messages = list.map(m => ({
      ...m,
      tempURL: urlMap[m.content] || m.content,
      timeText: formatTime(new Date(m.createTime), 'HH:mm')
    }));
    this.setData({
      messages,
      lastMessageId: messages.length ? `msg-${messages[messages.length-1].messageId}` : ''
    });
  },

  _onIncomingMessage(msg) {
    if (msg.type === 'image' || msg.type === 'file') {
      request('getTempFileURL', { fileIDs: [msg.content] }, { loading: false, silent: true })
        .then(res => {
          if (res && res[0]) msg.tempURL = res[0].tempFileURL;
          this._appendMessage(msg);
        })
        .catch(() => this._appendMessage(msg));
    } else {
      this._appendMessage(msg);
    }
  },

  _appendMessage(msg) {
    this.setData({
      messages: [...this.data.messages, { ...msg, timeText: formatTime(new Date(msg.createTime), 'HH:mm') }],
      lastMessageId: `msg-${msg.messageId}`
    });
    request('getChatMessages', {
      sessionId: this.data.session.sessionId, markRead: true
    }, { loading: false, silent: true }).catch(() => {});
  },

  _onSessionUpdate(s) {
    const wasActive = this.data.session && this.data.session.status === 1;
    this.setData({ session: s });
    // 状态从 1 -> 3 且未评价过 -> 弹评价
    if (wasActive && s.status === 3 && !s.rated && !this._endedShown) {
      this._endedShown = true;
      this.setData({ showRate: true });
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
    if (this.client && e.detail.value) this.client.onInputTyping();
  },

  async onSend() {
    const text = this.data.inputText.trim();
    if (!text) return;
    this.setData({ inputText: '' });
    try {
      // 发送前先尝试智能匹配
      const smart = await request('smartReply', {
        text, sessionId: this.data.session.sessionId
      }, { loading: false, silent: true });
      // 总是发出去(智能回复作为系统消息追加)
      const msg = await this.client.sendMessage(text);
      this._appendMessage({ ...msg, fromType: 'user', type: 'text', content: text });
      // 如果命中规则,AI 系统消息会自动写入(由云函数),此处再拉一次
      if (smart && smart.match) {
        setTimeout(() => this._loadHistory(), 300);
      }
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  // 选图片发送
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const file = res.tempFiles[0];
        wx.showLoading({ title: '上传中' });
        try {
          const ext = (file.tempFilePath.match(/\.(\w+)$/) || ['', '.jpg'])[0];
          const cloudPath = `chat/${this.data.session.sessionId}/${Date.now()}${ext}`;
          const r = await wx.cloud.uploadFile({ cloudPath, filePath: file.tempFilePath });
          const msg = await this.client.sendMessage(r.fileID, 'image');
          msg.tempURL = file.tempFilePath;
          this._appendMessage({ ...msg, fromType: 'user', type: 'image', content: r.fileID, tempURL: file.tempFilePath });
        } catch (e) {
          wx.showToast({ title: '发送失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  setRate(e) { this.setData({ rateScore: Number(e.currentTarget.dataset.s) }); },
  toggleTag(e) {
    const t = e.currentTarget.dataset.t;
    const tags = this.data.rateTags.includes(t)
      ? this.data.rateTags.filter(x => x !== t)
      : [...this.data.rateTags, t];
    this.setData({ rateTags: tags });
  },
  onRateComment(e) { this.setData({ rateComment: e.detail.value }); },
  closeRate() { this.setData({ showRate: false, rateScore: 0, rateTags: [], rateComment: '' }); },
  async submitRate() {
    try {
      await request('rateChat', {
        sessionId: this.data.session.sessionId,
        score: this.data.rateScore,
        tags: this.data.rateTags,
        comment: this.data.rateComment
      });
      wx.showToast({ title: '感谢您的评价' });
      this.closeRate();
    } catch (e) {}
  }
});
