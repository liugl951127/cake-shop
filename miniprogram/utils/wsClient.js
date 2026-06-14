// miniprogram/utils/wsClient.js
// 微信云函数 WebSocket 客户端(基于 wsGateway)
// 用法:
//   const ws = createWSClient({ sessionId, userId, role: 'user' });
//   ws.on('message', (msg) => {...});
//   ws.on('open', () => {...});
//   ws.send({ type: 'text', content: 'hi' });
//   ws.send({ type: 'rich', rich: [...] });
//   ws.sendImage(fileId, url);
//   ws.close();
//
// 实际云函数无法"长连接",这里采取策略:
//   - send 走 invoke(同步返回)
//   - 接收端用短轮询(poll) 模拟 push,间隔 2-3s
//   - 同时在 App 启动时尝试 wx.cloud.callFunction 长连接
//   - 真实生产可用 wx.cloud WebSocket

const POLL_INTERVAL = 2500;

function createWSClient(opts) {
  const { sessionId, userId, role } = opts;
  const listeners = {
    open: [],
    message: [],
    close: [],
    error: []
  };

  let running = false;
  let timer = null;
  let sinceTs = 0;
  let retry = 0;

  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[ws] listener err', e); }
    });
  }

  async function poll() {
    if (!running) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'wsGateway',
        data: { action: 'poll', sessionId, userId, role, sinceTs }
      });
      const r = res && res.result;
      if (r && r.code === 0) {
        retry = 0;
        if (r.data && r.data.messages) {
          for (const m of r.data.messages) {
            sinceTs = Math.max(sinceTs, m.ts || 0);
            emit('message', m);
          }
        }
      } else {
        emit('error', r);
      }
    } catch (e) {
      retry += 1;
      emit('error', e);
    }
    if (running) {
      timer = setTimeout(poll, Math.min(POLL_INTERVAL * Math.pow(1.3, Math.min(retry, 5)), 10000));
    }
  }

  async function call(action, data) {
    return await wx.cloud.callFunction({
      name: 'wsGateway',
      data: Object.assign({ action, sessionId, userId, role }, data || {})
    });
  }

  return {
    on(evt, fn) { if (listeners[evt]) listeners[evt].push(fn); },
    off(evt, fn) {
      if (!listeners[evt]) return;
      const i = listeners[evt].indexOf(fn);
      if (i >= 0) listeners[evt].splice(i, 1);
    },
    async open() {
      if (running) return;
      running = true;
      const res = await call('connect', {});
      if (res && res.result && res.result.code === 0) {
        sinceTs = Date.now() - 5000;  // 拉最近 5s
        emit('open', res.result.data);
        poll();
        return true;
      }
      running = false;
      return false;
    },
    async send(payload) {
      const res = await call('send', payload);
      return res && res.result;
    },
    async sendText(content, extra) {
      return this.send({ type: 'text', content, extra });
    },
    async sendRich(richNodes, extra) {
      return this.send({ type: 'rich', rich: richNodes, extra });
    },
    async sendImage(fileId, url, extra) {
      return this.send({
        type: 'image',
        extra: Object.assign({ fileId, url }, extra || {})
      });
    },
    async sendFile(fileId, url, name, extra) {
      return this.send({
        type: 'file',
        extra: Object.assign({ fileId, url, name }, extra || {})
      });
    },
    async sendProductCard(product, extra) {
      return this.send({
        type: 'product_card',
        extra: Object.assign({
          productId: product._id || product.id,
          name: product.name, image: product.image, price: product.price
        }, extra || {})
      });
    },
    async sendOrderCard(order, extra) {
      return this.send({
        type: 'order_card',
        extra: Object.assign({
          orderId: order._id || order.id,
          orderNo: order.orderNo,
          status: order.status,
          total: order.totalPrice || order.total
        }, extra || {})
      });
    },
    async ack(clientMsgId, serverMsgId) {
      return await call('ack', { clientMsgId, serverMsgId });
    },
    async close() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      try { await call('close', { userId }); } catch (e) {}
      emit('close', null);
    },
    isRunning() { return running; }
  };
}

module.exports = { createWSClient };
