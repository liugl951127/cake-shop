// utils/chatClient.js - 客服会话客户端(连接管理 + 心跳 + 重连)
// 抽象类,用户端和客服端都基于它
const { request } = require('./request.js');

const HEARTBEAT_INTERVAL = 15000;  // 15s
const MAX_BACKOFF = 30000;          // 最大 30s
const INITIAL_BACKOFF = 1000;       // 初始 1s

class ChatClient {
  /**
   * @param {Object} opts
   * @param {'user'|'admin'} opts.role
   * @param {Function} opts.onState  状态变化回调 (state) => void
   * @param {Function} opts.onMessage 收到消息 (msg) => void
   * @param {Function} opts.onPeerStateChange  对方状态变化 (online) => void
   * @param {Function} opts.onSessionUpdate  会话变化 (session) => void
   * @param {Function} opts.onTyping  对方正在输入
   */
  constructor(opts) {
    this.role = opts.role;
    this.onState = opts.onState || (() => {});
    this.onMessage = opts.onMessage || (() => {});
    this.onPeerStateChange = opts.onPeerStateChange || (() => {});
    this.onSessionUpdate = opts.onSessionUpdate || (() => {});
    this.onTyping = opts.onTyping || (() => {});

    this.sessionId = '';
    this._state = 'idle';           // idle/connecting/connected/reconnecting/closed
    this._heartbeatTimer = null;
    this._reconnectTimer = null;
    this._sessionWatcher = null;
    this._msgWatcher = null;
    this._typingWatcher = null;
    this._backoff = INITIAL_BACKOFF;
    this._closed = false;
    this._peerOnline = true;
    this._lastTypingAt = 0;
  }

  setState(s) {
    if (this._state === s) return;
    this._state = s;
    this.onState(s);
  }

  getState() { return this._state; }

  // 启动会话:获取/创建 session + 启动 watch
  async start(sessionId = '') {
    this._closed = false;
    this.setState('connecting');
    try {
      let s = null;
      if (sessionId) {
        // 已有 session: 走重连
        s = await request('reconnectChat', { role: this.role });
        s = s && s.sessionId ? s : s;
      } else {
        if (this.role === 'user') {
          s = await request('getOrCreateSession', {});
        } else {
          // 客服: 拉自己所有活跃会话,只取最近一个(实际项目可遍历)
          const list = await request('adminGetSessions', { onlyMine: true });
          s = list[0] || null;
        }
      }
      if (!s) {
        this.setState('idle');
        return null;
      }
      this.sessionId = s.sessionId;
      this.setState('connected');
      this._startWatch();
      this._startHeartbeat();
      this._backoff = INITIAL_BACKOFF;
      this._updatePeerState(s);
      return s;
    } catch (e) {
      this.setState('reconnecting');
      this._scheduleReconnect(sessionId);
      return null;
    }
  }

  // 重连
  reconnect() {
    if (this._closed) return;
    this.setState('reconnecting');
    this._stopWatch();
    this._stopHeartbeat();
    this._scheduleReconnect(this.sessionId);
  }

  _scheduleReconnect(sessionId) {
    if (this._closed) return;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this.start(sessionId);
    }, this._backoff);
    this._backoff = Math.min(this._backoff * 2, MAX_BACKOFF);
  }

  // 启动监听
  _startWatch() {
    this._stopWatch();
    if (!this.sessionId) return;
    const db = wx.cloud.database();
    const _ = db.command;

    // 1. 监听会话变化(对方状态/转接)
    this._sessionWatcher = db.collection('chatSessions')
      .where({ sessionId: this.sessionId })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs && snapshot.docs[0]) {
            const s = snapshot.docs[0];
            this._updatePeerState(s);
            this.onSessionUpdate(s);
          }
        },
        onError: () => this.reconnect()
      });

    // 2. 监听消息
    this._msgWatcher = db.collection('chatMessages')
      .where({ sessionId: this.sessionId })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docChanges) {
            for (const ch of snapshot.docChanges) {
              if (ch.queueType === 'enqueue' || ch.queueType === 'update') {
                const msg = ch.doc;
                // 过滤:自己发的不算,对方发的才触发
                const fromOpenid = msg._fromOpenid || msg._openid;
                if (fromOpenid === this._myOpenid()) continue;
                this.onMessage(msg);
              }
            }
          }
        },
        onError: () => this.reconnect()
      });

    // 3. 监听对方正在输入
    this._typingWatcher = db.collection('chatTyping')
      .where({
        sessionId: this.sessionId,
        role: this.role === 'user' ? 'admin' : 'user',
        typing: true
      })
      .watch({
        onChange: (snapshot) => {
          const has = snapshot.docs && snapshot.docs.length > 0;
          this.onTyping(has);
        },
        onError: () => {}
      });
  }

  _stopWatch() {
    if (this._sessionWatcher) { this._sessionWatcher.close(); this._sessionWatcher = null; }
    if (this._msgWatcher) { this._msgWatcher.close(); this._msgWatcher = null; }
    if (this._typingWatcher) { this._typingWatcher.close(); this._typingWatcher = null; }
  }

  _updatePeerState(session) {
    const peerConnected = this.role === 'user'
      ? session.adminConnected !== false
      : session.userConnected !== false;
    if (peerConnected !== this._peerOnline) {
      this._peerOnline = peerConnected;
      this.onPeerStateChange(peerConnected);
    }
  }

  // 启动心跳
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => this._heartbeat(), HEARTBEAT_INTERVAL);
    this._heartbeat(); // 立刻发一次
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
  }

  async _heartbeat() {
    if (this._closed) return;
    try {
      await request('chatHeartbeat', {
        sessionId: this.sessionId,
        role: this.role,
        clientState: this._state === 'connected' ? 'online' : 'reconnecting'
      }, { loading: false, silent: true });
    } catch (e) {
      this.reconnect();
    }
  }

  // 切后台
  onAppHide() {
    if (this._closed) return;
    request('chatHeartbeat', {
      sessionId: this.sessionId, role: this.role, clientState: 'background'
    }, { loading: false, silent: true }).catch(() => {});
    // 切后台后停掉心跳(微信会冻结)
    this._stopHeartbeat();
  }

  // 切回前台
  onAppShow() {
    if (this._closed || !this.sessionId) return;
    // 立即恢复心跳
    this._startHeartbeat();
    // 主动 reconnect 拉一次最新状态
    request('reconnectChat', { role: this.role }, { loading: false, silent: true })
      .then((s) => {
        if (s && (s.sessionId || s.sessions)) {
          this.setState('connected');
          if (s.sessionId && s.sessionId !== this.sessionId) {
            this.sessionId = s.sessionId;
            this._startWatch();
          } else if (s.sessions) {
            // 客服端批量更新
            this._startWatch();
          }
        }
      })
      .catch(() => this.reconnect());
  }

  // 页面卸载 / 杀进程
  onUnload(reason = 'unload') {
    if (this._closed) return;
    this._closed = true;
    this._stopWatch();
    this._stopHeartbeat();
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    // 同步上报(这里 fire-and-forget,因为进程要死了)
    request('leaveChat', {
      sessionId: this.sessionId, role: this.role, reason
    }, { loading: false, silent: true }).catch(() => {});
  }

  // 主动关闭(用户点"结束")
  close() {
    this.onUnload('leave');
  }

  // 发送消息
  async sendMessage(content, type = 'text', payload = null) {
    if (!this.sessionId) throw new Error('未连接会话');
    if (content && content.length > 0) {
      this._reportTyping(false);
    }
    return await request('sendChatMessage', {
      sessionId: this.sessionId, type, content, payload
    });
  }

  // 上报正在输入
  _reportTyping(typing = true) {
    request('chatTyping', {
      sessionId: this.sessionId, role: this.role, typing
    }, { loading: false, silent: true }).catch(() => {});
  }

  onInputTyping() {
    const now = Date.now();
    if (now - this._lastTypingAt < 2000) return;
    this._lastTypingAt = now;
    this._reportTyping(true);
    // 5s 后自动关闭
    setTimeout(() => this._reportTyping(false), 5000);
  }

  _myOpenid() {
    try { return wx.getStorageSync('userInfo').openid || ''; } catch (e) { return ''; }
  }
}

module.exports = { ChatClient, HEARTBEAT_INTERVAL };
