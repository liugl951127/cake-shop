// miniprogram/utils/wsClient.js v2
// WS 客户端 - 自动重连 + 心跳 + 断线记录 + 设备能力上报
// 用法:
//   const ws = createWSClient({ sessionId, userId, role: 'user' });
//   ws.on('open', ...);
//   ws.on('message', ...);
//   ws.on('disconnect', (info) => {...});  // 断线
//   ws.on('reconnect', (info) => {...});   // 重连
//   ws.send({ type: 'text', content: 'hi' });

const device = require('./device.js');
const offlineQueue = require('./offlineQueue.js');
const monitor = require('./monitor.js');

const POLL_INTERVAL = 2500;
const HEARTBEAT_INTERVAL = 10 * 1000;
const HEARTBEAT_TIMEOUT = 30 * 1000;
const MAX_RETRY_DELAY = 60 * 1000;

function createWSClient(opts) {
  const { sessionId, userId, role } = opts;
  const listeners = {
    open: [], message: [], close: [],
    error: [], disconnect: [], reconnect: [], state: []
  };
  let state = 'idle';  // idle | connecting | open | disconnected | reconnecting | failed
  let running = false;
  let pollTimer = null;
  let hbTimer = null;
  let retryTimer = null;
  let sinceTs = 0;
  let retry = 0;
  let connectedAt = 0;
  let lastDisconnectAt = 0;
  let networkType = 'unknown';
  let monitorTag = 'ws.' + (role || 'user');

  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[ws] listener err', e); }
    });
  }
  function setState(s) {
    if (state === s) return;
    state = s;
    emit('state', { state: s });
  }

  async function call(action, data) {
    return await wx.cloud.callFunction({
      name: 'wsGateway',
      data: Object.assign({ action, sessionId, userId, role }, data || {})
    });
  }

  async function connect() {
    if (state === 'connecting' || state === 'open') return true;
    setState('connecting');
    try {
      const res = await call('connect', { deviceInfo: device.getDeviceInfo() });
      const r = res && res.result;
      if (r && r.code === 0) {
        sinceTs = Date.now() - 5000;
        connectedAt = Date.now();
        retry = 0;
        setState('open');
        monitor.metric(monitorTag + '.connect.success', 1, { isReconnect: r.data.isReconnect });
        emit('open', r.data);
        if (r.data.isReconnect) emit('reconnect', r.data);
        startPoll();
        startHeartbeat();
        return true;
      }
      setState('failed');
      return false;
    } catch (e) {
      setState('failed');
      emit('error', e);
      return false;
    }
  }

  async function startPoll() {
    if (pollTimer) return;
    const tick = async () => {
      if (!running) return;
      try {
        const res = await call('poll', { sinceTs });
        const r = res && res.result;
        if (r && r.code === 0) {
          if (r.data && r.data.messages) {
            for (const m of r.data.messages) {
              sinceTs = Math.max(sinceTs, m.ts || 0);
              emit('message', m);
            }
          }
        } else {
          // 拉取失败 -> 视为断线
          handleDisconnect('poll_fail');
        }
      } catch (e) {
        handleDisconnect('poll_exception');
      }
      if (running) pollTimer = setTimeout(tick, POLL_INTERVAL);
    };
    tick();
  }

  function startHeartbeat() {
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(async () => {
      if (!running) return;
      try {
        const res = await call('heartbeat', { ts: Date.now(), network: networkType });
        const r = res && res.result;
        if (!r || r.code !== 0) {
          handleDisconnect('heartbeat_fail');
        }
      } catch (e) {
        handleDisconnect('heartbeat_exception');
      }
    }, HEARTBEAT_INTERVAL);
  }

  function stopTimers() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  }

  async function handleDisconnect(reason) {
    if (state === 'disconnected' || state === 'reconnecting') return;
    setState('disconnected');
    lastDisconnectAt = Date.now();
    stopTimers();
    const durationMs = connectedAt ? Date.now() - connectedAt : 0;
    // 上报断线
    try {
      await call('disconnect', { reason, durationMs, network: networkType });
    } catch (e) {}
    monitor.metric(monitorTag + '.disconnect', 1, { reason, durationMs });
    emit('disconnect', { reason, durationMs });
    // 自动重连
    scheduleReconnect(reason);
  }

  function scheduleReconnect(reason) {
    retry += 1;
    const delay = Math.min(1000 * Math.pow(1.5, retry - 1), MAX_RETRY_DELAY);
    setState('reconnecting');
    monitor.metric(monitorTag + '.reconnect.scheduled', 1, { reason, attempt: retry, delay });
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(async () => {
      if (!running) return;
      const ok = await connect();
      if (!ok) scheduleReconnect('reconnect_fail');
    }, delay);
  }

  // 网络监听
  let unsubNet = () => {};
  let unsubResize = () => {};

  return {
    on(evt, fn) { if (listeners[evt]) listeners[evt].push(fn); },
    off(evt, fn) {
      if (!listeners[evt]) return;
      const i = listeners[evt].indexOf(fn);
      if (i >= 0) listeners[evt].splice(i, 1);
    },
    async open() {
      running = true;
      // 监听网络
      unsubNet = device.onNetworkChange(res => {
        networkType = res.networkType;
        if (!res.isConnected) {
          offlineQueue.markOffline('network');
          handleDisconnect('network_lost');
        } else {
          offlineQueue.markOnline();
          if (state === 'disconnected' || state === 'reconnecting') {
            scheduleReconnect('network_back');
          } else if (state === 'open' || state === 'failed') {
            connect();
          }
        }
      });
      // 折叠屏 resize 不影响 ws 连接
      return await connect();
    },
    async send(payload) {
      if (state !== 'open') {
        // 离线: 入队
        offlineQueue.push({
          type: 'chat.message',
          payload: Object.assign({ sessionId, from: userId, fromRole: role || 'user' }, payload)
        });
        monitor.metric(monitorTag + '.send.queued', 1, { type: payload.type });
        return { queued: true, ts: Date.now() };
      }
      const res = await call('send', payload);
      return res && res.result;
    },
    async sendText(content) { return this.send({ type: 'text', content }); },
    async sendRich(richNodes) { return this.send({ type: 'rich', rich: richNodes }); },
    async sendImage(fileId, url) { return this.send({ type: 'image', extra: { fileId, url } }); },
    async sendFile(fileId, url, name) { return this.send({ type: 'file', extra: { fileId, url, name } }); },
    async sendProductCard(p) { return this.send({ type: 'product_card', extra: p }); },
    async sendOrderCard(o) { return this.send({ type: 'order_card', extra: o }); },
    async ack(clientMsgId, serverMsgId) {
      return await call('ack', { clientMsgId, serverMsgId });
    },
    async close() {
      running = false;
      stopTimers();
      unsubNet(); unsubResize();
      try { await call('close', { userId }); } catch (e) {}
      setState('idle');
      emit('close', null);
    },
    getState() { return state; },
    isRunning() { return running; }
  };
}

module.exports = { createWSClient };
