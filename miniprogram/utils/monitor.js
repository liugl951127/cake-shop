// miniprogram/utils/monitor.js
// 性能监控 + 异常上报 SDK(客户端)
// 用法:
//   const monitor = require('monitor.js');
//   monitor.init({ app });
//   monitor.metric('page.load', 234, { page: '/pages/index' });
//   monitor.error(err, { page: '...' });
//
// 自动:
//   - App.onError: 拦截未捕获异常
//   - Page.onLoad: 记录页面加载时长
//   - 5s/20 条 flush
//   - 相同 message+stack 5min 内只上报一次

const MONITOR_QUEUE_MAX = 50;
const ERROR_DEDUP_TTL = 5 * 60;  // 秒

let queue = { metrics: [], errors: [] };
let lastFlush = 0;
const FLUSH_INTERVAL = 5000;
let app = null;
let deviceId = '';

function getOpenid() { try { return wx.getStorageSync('openid') || ''; } catch (e) { return ''; } }
function getUserId() { try { return wx.getStorageSync('userId') || ''; } catch (e) { return ''; } }
function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    deviceId = wx.getStorageSync('deviceId') || ('dev-' + Math.random().toString(36).slice(2, 12));
    wx.setStorageSync('deviceId', deviceId);
  } catch (e) { deviceId = 'dev-anon'; }
  return deviceId;
}

function dedupKey(item) {
  const m = (item.message || '').slice(0, 200);
  const s = (item.stack || '').split('\n')[1] || '';
  return m + '|' + s;
}

const dedupMap = new Map();
function isDup(item) {
  const k = dedupKey(item);
  const now = Date.now();
  if (dedupMap.has(k)) {
    if (now - dedupMap.get(k) < ERROR_DEDUP_TTL * 1000) return true;
  }
  dedupMap.set(k, now);
  return false;
}

function pushMetric(m) {
  queue.metrics.push(m);
  if (queue.metrics.length + queue.errors.length >= MONITOR_QUEUE_MAX) flush();
}

function pushError(e) {
  const item = {
    message: e.message || String(e),
    stack: e.stack || '',
    type: e.name || 'Error',
    scene: e.scene || 'miniprogram',
    level: e.level || 'error',
    context: e.context || null
  };
  if (isDup(item)) return;
  queue.errors.push(item);
}

async function flush() {
  if (queue.metrics.length === 0 && queue.errors.length === 0) return;
  const metrics = queue.metrics;
  const errors = queue.errors;
  queue = { metrics: [], errors: [] };
  lastFlush = Date.now();

  if (metrics.length) {
    wx.cloud.callFunction({
      name: 'reportMetric',
      data: {
        metrics: metrics.map(m => ({
          name: m.name,
          value: m.value,
          tags: m.tags || {},
          tenantId: m.tenantId
        })),
        userId: getUserId(),
        openid: getOpenid(),
        deviceId: getDeviceId()
      },
      fail: (err) => {
        console.warn('[monitor] metric flush fail', err);
        // 失败放回(只回 metrics,避免异常重复)
        queue.metrics = metrics.concat(queue.metrics);
      }
    });
  }

  for (const e of errors) {
    wx.cloud.callFunction({
      name: 'reportError',
      data: Object.assign({}, e, {
        userId: getUserId(),
        openid: getOpenid(),
        deviceId: getDeviceId()
      }),
      fail: (err) => {
        console.warn('[monitor] error flush fail', err);
      }
    });
  }
}

const monitor = {
  init(opts = {}) {
    app = opts.app || getApp();
    deviceId = getDeviceId();
    setInterval(() => {
      if (Date.now() - lastFlush > FLUSH_INTERVAL) flush();
    }, FLUSH_INTERVAL);
    if (app) {
      try {
        // 拦截未捕获异常
        const oldOnError = app.onError;
        app.onError = function (err) {
          monitor.error(err, { scene: 'app.onError' });
          if (oldOnError) oldOnError.call(this, err);
        };
        const oldOnHide = app.onHide;
        app.onHide = function () {
          flush();
          if (oldOnHide) oldOnHide.call(this);
        };
      } catch (e) {}
    }
    // 拦截 Promise 异常
    if (typeof wx !== 'undefined' && wx.onUnhandledRejection) {
      try {
        wx.onUnhandledRejection(res => {
          monitor.error(res.reason || res, { scene: 'unhandledRejection' });
        });
      } catch (e) {}
    }
  },

  metric(name, value, tags) {
    pushMetric({ name, value, tags: tags || {}, ts: Date.now() });
  },

  error(err, context) {
    if (!err) return;
    if (typeof err === 'string') err = new Error(err);
    pushError({
      message: err.message || 'unknown',
      stack: err.stack || '',
      type: err.name || 'Error',
      scene: (context && context.scene) || 'miniprogram',
      level: (context && context.level) || 'error',
      context: context || null
    });
    // 立即 flush 错误
    flush();
  },

  // 装饰: 包装一个 promise,自动打点 + 异常捕获
  async wrap(name, fn, tags) {
    const start = Date.now();
    try {
      const r = await fn();
      monitor.metric(name + '.success', Date.now() - start, tags);
      return r;
    } catch (e) {
      monitor.metric(name + '.fail', Date.now() - start, tags);
      monitor.error(e, { scene: 'monitor.wrap:' + name, extra: tags });
      throw e;
    }
  },

  flush,
  queueSize() { return queue.metrics.length + queue.errors.length; }
};

module.exports = monitor;
