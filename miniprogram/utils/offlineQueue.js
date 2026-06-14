// miniprogram/utils/offlineQueue.js
// 离线操作队列
//   - 网络断开 / App onHide / 异常断线: 操作进本地队列
//   - 上线: 批量同步到 syncOfflineOp 云函数
//   - 去重: 30 天 opId 缓存
//   - 持久化: wx.storage
//
// 用法:
//   const oq = require('./utils/offlineQueue.js');
//   oq.init();
//   oq.push({ type: 'chat.message', payload: {...} });
//   // 上线自动 sync
//   oq.flush();      // 手动
//   oq.on('sync', ({ accepted, deduped }) => {});

const monitor = require('./monitor.js');
const device = require('./device.js');

const STORAGE_KEY = '__offline_ops__';
const SYNC_BATCH = 100;
const SYNC_INTERVAL = 3000;     // 3s 定时
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 天
const MAX_QUEUE_SIZE = 5000;

let queue = [];          // [{ opId, type, payload, ts, traceId }]
let meta = null;         // { disconnectedAt, reason }
let listeners = { sync: [] };
let timer = null;
let syncing = false;
let retryCount = 0;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function genBatchId() {
  return 'batch-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function genClientId() {
  try {
    let id = wx.getStorageSync('__offline_client_id__');
    if (!id) {
      id = 'cli-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      wx.setStorageSync('__offline_client_id__', id);
    }
    return id;
  } catch (e) {
    return 'cli-anon-' + genId();
  }
}

function load() {
  try {
    const s = wx.getStorageSync(STORAGE_KEY);
    if (s && s.queue) {
      queue = s.queue || [];
      meta = s.meta || null;
    }
  } catch (e) { /* ignore */ }
  // 清理过期
  const now = Date.now();
  queue = queue.filter(op => (now - (op.ts || 0)) < MAX_AGE_MS);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(-MAX_QUEUE_SIZE);
  }
}

function save() {
  try {
    wx.setStorageSync(STORAGE_KEY, { queue, meta });
  } catch (e) {
    console.warn('[offlineQueue] save fail', e);
  }
}

function push(op) {
  if (!op || !op.type) return;
  const item = {
    opId: op.opId || genId(),
    type: op.type,
    payload: op.payload || null,
    ts: op.ts || Date.now(),
    traceId: op.traceId || ''
  };
  queue.push(item);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(-MAX_QUEUE_SIZE);
  }
  save();
  // 立刻试一次 flush(如果已联网)
  setTimeout(() => { if (!meta) flush(); }, 100);
  return item.opId;
}

function markOffline(reason) {
  if (meta) return;  // 已离线
  meta = {
    disconnectedAt: Date.now(),
    reason: reason || 'network'
  };
  save();
  monitor.metric('offline.start', 1, { reason });
}

function markOnline() {
  if (!meta) return;
  const duration = Date.now() - meta.disconnectedAt;
  meta = null;
  save();
  monitor.metric('offline.end', duration, {});
  setTimeout(flush, 200);
}

async function flush() {
  if (syncing) return;
  if (queue.length === 0) return;
  if (meta) return;  // 还在离线
  syncing = true;
  try {
    const batch = queue.slice(0, SYNC_BATCH);
    const batchId = genBatchId();
    const deviceInfo = device.getDeviceInfo();
    const callRes = await wx.cloud.callFunction({
      name: 'syncOfflineOp',
      data: {
        batchId,
        clientId: genClientId(),
        ops: batch,
        deviceInfo
      }
    });
    const r = callRes && callRes.result;
    if (r && r.code === 0) {
      // 移除已上报的
      queue = queue.slice(batch.length);
      retryCount = 0;
      save();
      monitor.metric('offline.sync.success', 1, { count: batch.length });
      emit('sync', r.data || {});
      // 继续 flush
      if (queue.length > 0) setTimeout(flush, 200);
    } else {
      // 失败:重试
      retryCount += 1;
      monitor.metric('offline.sync.fail', 1, { code: r && r.code });
      if (retryCount < 5) {
        setTimeout(flush, Math.min(1000 * Math.pow(2, retryCount), 30000));
      } else {
        // 5 次失败: 退回离线
        markOffline('sync_fail');
      }
    }
  } catch (e) {
    console.warn('[offlineQueue] flush fail', e);
    retryCount += 1;
    if (retryCount < 3) setTimeout(flush, 5000);
    else markOffline('sync_exception');
  } finally {
    syncing = false;
  }
}

function emit(evt, data) {
  (listeners[evt] || []).forEach(fn => {
    try { fn(data); } catch (e) { console.warn('[offlineQueue] listener err', e); }
  });
}

const oq = {
  init() {
    load();
    // 定时 flush(尝试)
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (!meta && queue.length > 0) flush();
    }, SYNC_INTERVAL);
    // 网络监听
    device.onNetworkChange(res => {
      if (res.isConnected) {
        markOnline();
      } else {
        markOffline('network');
      }
    });
    // App 切到后台: 不是断线,但可以做一次 flush
    if (typeof getApp === 'function') {
      try {
        const a = getApp();
        if (a) {
          const oldHide = a.onHide;
          a.onHide = function () {
            flush();
            if (oldHide) oldHide.call(this);
          };
        }
      } catch (e) {}
    }
  },

  push,
  flush,
  markOffline,
  markOnline,
  on(evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); },
  isOffline() { return !!meta; },
  getMeta() { return meta; },
  size() { return queue.length; },
  // 调试
  clear() { queue = []; meta = null; save(); }
};

module.exports = oq;
