// miniprogram/utils/tracker.js
// 客户端行为埋点 SDK
// 用法:
//   const tracker = require('tracker.js');
//   tracker.init();  // App.onLaunch 调一次
//   tracker.pageView('/pages/index/index');
//   tracker.click('add-cart', { goodsId: 123 });
//   tracker.stay(1500);  // 页面停留时长(ms)
//
// 改 v36.1: 不再调 wx.cloud.callFunction, 改用直连后端 (request.js)
//   - 失败: 静默 log warn, 不影响业务
//   - 队列上限 50 条, 超了丢老的(避免占用太多内存)

const { MessageType } = require('./messageTypes.js');   // 复用 client 端定义
const { getOpenid, getUserId } = require('./auth.js');     // 复用统一 helper

// 内存队列
let queue = [];
let flushing = false;
let lastFlush = 0;
const FLUSH_INTERVAL = 5000;       // 5s 自动 flush
const MAX_QUEUE = 50;              // 超过 50 丢老的
const MAX_BATCH = 100;

let app = null;
let deviceId = '';
let sessionId = '';                 // 本次会话 ID(随机生成,12小时有效)
let sessionExpire = 0;
let pageStack = new Map();          // 页面路径 -> 进栈时间
let lastPage = '';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function ensureSession() {
  const now = Date.now();
  if (!sessionId || now > sessionExpire) {
    sessionId = genId();
    sessionExpire = now + 12 * 60 * 60 * 1000;
  }
  return sessionId;
}

function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    deviceId = wx.getStorageSync('deviceId') || '';
    if (!deviceId) {
      deviceId = 'dev-' + genId();
      wx.setStorageSync('deviceId', deviceId);
    }
  } catch (e) {
    deviceId = 'dev-anon';
  }
  return deviceId;
}

function push(log) {
  queue.push({
    type: log.type,
    page: log.page || lastPage,
    element: log.element || '',
    payload: log.payload || null,
    ts: log.ts || Date.now()
  });
  if (queue.length >= MAX_QUEUE) {
    // 丢老的,留新的
    queue = queue.slice(-MAX_QUEUE / 2);
  }
}

function flush() {
  if (flushing) return;
  if (queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);

  const payload = {
    logs: batch,
    sessionId: ensureSession(),
    deviceId: getDeviceId(),
    scene: 'miniprogram'
  };
  const userId = getUserId();
  if (userId) payload.userId = userId;
  const openid = getOpenid();
  if (openid) payload.openid = openid;

  // 用直连后端(用 require 而非顶层 require,避免循环)
  try {
    const { request } = require('./request.js');
    request({
      url: '/client-errors/behavior',
      method: 'POST',
      data: payload,
      // 失败:静默,不重试
      fail: () => { queue = batch.concat(queue).slice(-MAX_QUEUE); },
      success: () => { lastFlush = Date.now(); }
    });
  } catch (e) {
    console.warn('[tracker] flush fail', e);
    queue = batch.concat(queue).slice(-MAX_QUEUE);
  } finally {
    flushing = false;
  }
}

const tracker = {
  init(opts = {}) {
    app = opts.app || getApp();
    ensureSession();
    getDeviceId();
    // 定时 flush
    setInterval(() => {
      if (Date.now() - lastFlush > FLUSH_INTERVAL && queue.length > 0) flush();
    }, FLUSH_INTERVAL);
    // 进入后台时 flush
    if (app) {
      try {
        const oldOnHide = app.onHide;
        app.onHide = function () {
          flush();
          if (oldOnHide) oldOnHide.call(this);
        };
      } catch (e) {}
    }
  },

  pageView(path) {
    lastPage = path;
    pageStack.set(path, Date.now());
    push({ type: MessageType.PAGE_VIEW, page: path });
  },

  pageLeave(path) {
    const enter = pageStack.get(path);
    const duration = enter ? Date.now() - enter : 0;
    pageStack.delete(path);
    push({
      type: MessageType.PAGE_STAY, page: path,
      payload: { durationMs: duration }
    });
  },

  click(name, payload) {
    push({ type: MessageType.ELEMENT_CLICK, element: name, payload: payload || null });
  },

  expose(name, payload) {
    push({ type: MessageType.ELEMENT_EXPOSE, element: name, payload: payload || null });
  },

  formInput(form, field) {
    push({
      type: MessageType.FORM_INPUT, page: lastPage,
      element: form + ':' + field
    });
  },

  formSubmit(form, payload) {
    push({ type: MessageType.FORM_SUBMIT, element: form, payload: payload || null });
  },

  search(keyword, payload) {
    push({ type: MessageType.SEARCH, payload: Object.assign({ keyword }, payload || {}) });
  },

  share(target, payload) {
    push({ type: MessageType.SHARE, element: target, payload: payload || null });
  },

  addCart(goodsId, payload) {
    push({ type: MessageType.ADD_CART, payload: Object.assign({ goodsId }, payload || {}) });
  },

  favor(target, payload) {
    push({ type: MessageType.FAVOR, element: target, payload: payload || null });
  },

  payStart(orderId, amount) {
    push({ type: MessageType.PAY_START, payload: { orderId, amount } });
  },

  paySuccess(orderId, amount) {
    push({ type: MessageType.PAY_SUCCESS, payload: { orderId, amount } });
  },

  login(method) {
    push({ type: MessageType.LOGIN, payload: { method } });
  },

  logout() {
    push({ type: MessageType.LOGOUT });
  },

  // 自定义
  custom(type, payload) {
    push({ type, payload: payload || null });
  },

  flush,
  // 调试用
  queueSize() { return queue.length; }
};

module.exports = tracker;
