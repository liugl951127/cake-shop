// pages/chat/session/session.js
// 客服会话页面
//   - 状态轮询 + 实时消息
//   - 转人工 / 挂断 / 评价
//   - 发送消息: 文本 / 富文本(图/视频/文件/位置/语音)
const { request } = require('../../../../utils/request.js');
const { getUser } = require('../../../../utils/auth.js');
const { formatTime } = require('../../../../utils/util.js');
const { ChatClient } = require('../../../utils/chatClient.js');
const authz = require('../../../../utils/auth.js');
const monitor = require('../../../../utils/monitor.js');
const nav = require('../../../../utils/nav');

Page({
  data: {
    sessionId: '',
    userId: '',
    openid: '',
    status: 'pending',
    transferredToWeCom: false,
    messages: [],
    stateText: '连接中...',
    stateClass: 'pending',
    inputText: '',
    peerTyping: false,
    showRate: false,
    rateScore: 0,
    rateTags: [],
    rateTagsOptions: ['回复快','态度好','专业','解决了问题','很热情'],
    rateTagsList: [],
    rateComment: '',
    sendDisabled: false,
    showSendPanel: false
  },

  onLoad(query) {
    this.setData({
      sessionId: query.sessionId || '',
      userId: (getUser() || {}).userId || '',
      openid: wx.getStorageSync('openid') || ''
    });
    this.refreshStatus();
    this._timer = setInterval(() => this.refreshStatus(), 5000);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
    if (this._wsClient) try { this._wsClient.close(); } catch (e) {}
  },

  async refreshStatus() {
    if (!this.data.sessionId) return;
    try {
      const r = await wx.cloud.callFunction({
        name: 'queryChatHistory',
        data: { sessionId: this.data.sessionId, size: 1, page: 1, withRich: false }
      });
    } catch (e) {}
  },

  onTransferSuccess(e) {
    this.setData({ transferredToWeCom: true, status: 'transferred' });
  },
  onTransferError(e) {
    console.warn('transfer error', e);
  },
  onHangup(e) {
    this.setData({ status: 'closed' });
  },
  onRated(e) {
    console.log('rated', e.detail);
  },

  // === 文本输入 ===
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  onFocus() {},
  async onSend() {
    const text = (this.data.inputText || '').trim();
    if (!text) return;
    if (this.data.sendDisabled) return;
    this.setData({ sendDisabled: true });
    try {
      // 文本发送
      const ok = await this._send({ type: 'text', content: text });
      if (ok) this.setData({ inputText: '' });
    } finally {
      this.setData({ sendDisabled: false });
    }
  },

  // === 工具栏 - 展开/收起 ===
  toggleSendPanel() {
    this.setData({ showSendPanel: !this.data.showSendPanel });
  },

  // === 发送图片 ===
  async onSendImage() {
    try {
      const files = await authz.chooseImage({ count: 1, sourceType: ['album', 'camera'] });
      if (files && files[0]) {
        await this._send({
          type: 'rich',
          rich: [{
            t: 'img',
            v: files[0].fileId,
            a: { w: 200, thumb: files[0].fileId }
          }]
        });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' });
    }
    this.setData({ showSendPanel: false });
  },

  // === 发送视频 ===
  async onSendVideo() {
    try {
      // 视频 - 走 chooseMedia
      const r = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['video'],
          sourceType: ['album', 'camera'],
          maxDuration: 60,
          camera: 'back',
          success: resolve,
          fail: reject
        });
      });
      const f = r.tempFiles && r.tempFiles[0];
      if (!f) return;
      // 上传
      const up = await this._uploadFile(f.tempFilePath, 'video');
      if (up && up.fileId) {
        await this._send({
          type: 'rich',
          rich: [{
            t: 'video',
            v: up.fileId,
            a: {
              w: f.width || 0,
              h: f.height || 0,
              duration: Math.round((f.duration || 0) / 1000),
              thumb: up.fileId
            }
          }]
        });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' });
    }
    this.setData({ showSendPanel: false });
  },

  // === 发送文件 ===
  async onSendFile() {
    try {
      const files = await authz.chooseMessageFile({ count: 1 });
      if (files && files[0]) {
        await this._send({
          type: 'rich',
          rich: [{
            t: 'file',
            v: files[0].fileId,
            a: {
              name: (files[0].cloudPath || '').split('/').pop() || '文件',
              size: 0,
              mime: ''
            }
          }]
        });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' });
    }
    this.setData({ showSendPanel: false });
  },

  // === 发送位置 ===
  async onSendLocation() {
    try {
      const loc = await authz.getLocation({ accuracy: 'gcj02', scope: 'CN' });
      if (loc) {
        await this._send({
          type: 'rich',
          rich: [{
            t: 'location',
            v: loc.latitude + ',' + loc.longitude,
            a: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              name: '我的位置',
              accuracy: loc.accuracy
            }
          }]
        });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '位置获取失败', icon: 'none' });
    }
    this.setData({ showSendPanel: false });
  },

  // === 录音 - 语音 ===
  _recordStart() {
    authz.startRecord({ format: 'mp3' })
      .then((manager) => {
        this._recorder = manager;
        manager.onStop((res) => {
          if (res && res.tempFilePath) {
            this._uploadFile(res.tempFilePath, 'voice')
              .then((up) => this._send({
                type: 'rich',
                rich: [{
                  t: 'voice',
                  v: up.fileId,
                  a: { duration: Math.round((res.duration || 0) / 1000) }
                }]
              }))
              .catch(() => {});
          }
        });
      })
      .catch((err) => wx.showToast({ title: err.message || '麦克风未授权', icon: 'none' }));
  },
  _recordStop() {
    if (this._recorder) {
      try { this._recorder.stop(); } catch (e) {}
      this._recorder = null;
    }
  },

  async _uploadFile(filePath, type) {
    return new Promise((resolve, reject) => {
      const ext = (filePath.match(/\.[^.]+$/) || ['.jpg'])[0];
      const cloudPath = `chat/${type}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => resolve({ fileId: res.fileID, cloudPath }),
        fail: reject
      });
    });
  },

  // === 通用发送 ===
  async _send(payload) {
    if (!this.data.sessionId) return false;
    try {
      const r = await wx.cloud.callFunction({
        name: 'wsGateway',
        data: {
          action: 'send',
          sessionId: this.data.sessionId,
          ...payload
        }
      });
      const res = r && r.result;
      if (res && res.code === 0) {
        if (typeof monitor !== 'undefined') {
          monitor.event('chat_send', { type: payload.type, sessionId: this.data.sessionId });
        }
        return true;
      }
      wx.showToast({ title: (res && res.msg) || '发送失败', icon: 'none' });
      return false;
    } catch (e) {
      wx.showToast({ title: e.message || '网络错误', icon: 'none' });
      return false;
    }
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    authz.previewImage(url, [url])
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  // === 评价 ===
  setRate(e) { this.setData({ rateScore: e.currentTarget.dataset.s }); },
  toggleTag(e) {
    const t = e.currentTarget.dataset.t;
    const tags = this.data.rateTags.slice();
    const i = tags.indexOf(t);
    if (i >= 0) tags.splice(i, 1); else tags.push(t);
    // 同步 rateTagsList (避免 wxml 里调 .includes)
    const sel = new Set(tags);
    const list = (this.data.rateTagsOptions || []).map(name => ({
      name,
      selected: sel.has(name)
    }));
    this.setData({ rateTags: tags, rateTagsList: list });
  },
  onRateComment(e) { this.setData({ rateComment: e.detail.value }); },
  closeRate() { this.setData({ showRate: false }); },
  async submitRate() {
    // 调云函数
    try {
      await wx.cloud.callFunction({
        name: 'rateService',
        data: {
          sessionId: this.data.sessionId,
          score: this.data.rateScore,
          tags: this.data.rateTags,
          comment: this.data.rateComment
        }
      });
      wx.showToast({ title: '感谢您的评价' });
      this.setData({ showRate: false });
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  }
});
