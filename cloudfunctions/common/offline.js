// common/offline.js
// 离线操作 + 断线记录
//   - 客户端断线期间,操作进本地队列
//   - 上线后批量上报,服务端按 opTime 排序回放
//   - 断线期间的聊天/订单/支付/点赞等都可走
//
// 数据规范:
//   { batchId, clientId, sessionId,
//     ops: [
//       { opId, type, payload, ts: 客户端时戳, traceId },
//       ...
//     ],
//     deviceInfo,
//     disconnectedAt, reconnectedAt,
//     reason: 'network' | 'app_hide' | 'os_kill' | 'manual' }

const { logger } = require('./logger.js');
const { cache } = require('./cache.js');
const { num } = require('./transaction.js');
const { extractTenantId } = require('./tenant.js');
const { normalizeDevice } = require('./device.js');
const { ErrorCode, BizError } = require('./errors.js');

const MAX_OPS_PER_BATCH = 500;
const MAX_OP_PAYLOAD = 64 * 1024; // 64KB
const MAX_OFFLINE_DAYS = 7;
const REPLAY_DEDUP_TTL = 30 * 24 * 60 * 60;  // 30 天

/**
 * 接收一批离线操作
 *   - 校验
 *   - 去重(opId 30 天内不重复)
 *   - 落库(offline_op_batches + offline_ops)
 *   - 触发业务回放
 */
async function acceptBatch(db, event) {
  const batchId = event.batchId;
  const clientId = event.clientId;
  const sessionId = event.sessionId || '';
  const tenantId = extractTenantId(event);
  const ops = Array.isArray(event.ops) ? event.ops : [];
  const disconnectedAt = event.disconnectedAt || 0;
  const reconnectedAt = event.reconnectedAt || Date.now();
  const reason = event.reason || 'network';
  let deviceInfo = null;
  if (event.deviceInfo) {
    try { deviceInfo = normalizeDevice({ deviceInfo: event.deviceInfo }); } catch (e) { /* ignore */ }
  }

  if (!batchId) throw new BizError(ErrorCode.OFFLINE_OP_INVALID, 'batchId 必填');
  if (!clientId) throw new BizError(ErrorCode.OFFLINE_OP_INVALID, 'clientId 必填');
  if (ops.length === 0) {
    return { batchId, accepted: 0, deduped: 0, replayed: 0 };
  }
  if (ops.length > MAX_OPS_PER_BATCH) {
    throw new BizError(ErrorCode.OFFLINE_OP_PAYLOAD_TOO_LARGE,
      `单次最多 ${MAX_OPS_PER_BATCH} 条`);
  }
  if (reconnectedAt - disconnectedAt > MAX_OFFLINE_DAYS * 24 * 60 * 60 * 1000) {
    throw new BizError(ErrorCode.OFFLINE_OP_TOO_OLD, '离线时长超过 7 天');
  }

  // 1. 去重
  const accepted = [];
  const deduped = [];
  for (const op of ops) {
    if (!op.opId) continue;
    const dedupKey = `offline-op:${clientId}:${op.opId}`;
    if (cache.get(dedupKey)) {
      deduped.push(op);
      continue;
    }
    cache.set(dedupKey, 1, REPLAY_DEDUP_TTL);
    accepted.push(op);
  }

  // 2. 落库
  const now = Date.now();
  const batchDoc = {
    batchId, clientId, sessionId, tenantId,
    opsCount: accepted.length,
    dedupedCount: deduped.length,
    disconnectedAt, reconnectedAt, reason,
    deviceInfo, status: 'pending', createdAt: now
  };
  await db.collection('offline_op_batches').add({ data: batchDoc });

  // 拆 100 一批入库
  for (let i = 0; i < accepted.length; i += 100) {
    const slice = accepted.slice(i, i + 100);
    await db.collection('offline_ops').add({
      data: slice.map(o => ({
        batchId, clientId, sessionId, tenantId,
        opId: o.opId, type: o.type, payload: o.payload || null,
        ts: o.ts || now, traceId: o.traceId || '',
        status: 'pending', createdAt: now
      }))
    });
  }

  // 3. 触发回放(异步,不阻塞响应)
  const replayed = await replayBatch(db, batchId, accepted);

  // 4. 更新 batch 状态
  await db.collection('offline_op_batches')
    .where({ batchId }).update({ data: { status: 'done', updatedAt: now, replayedCount: replayed } })
    .catch(e => logger.warn('update batch status fail', { e: e.message }));

  logger.info('offline batch accepted', {
    batchId, clientId, accepted: accepted.length, deduped: deduped.length, replayed, reason, tenantId
  });

  return {
    batchId,
    accepted: accepted.length,
    deduped: deduped.length,
    replayed,
    offlineDurationMs: reconnectedAt - disconnectedAt
  };
}

/**
 * 回放一批操作
 *   - 按 op.ts 升序
 *   - 已知 type 走专门 handler
 *   - 未知 type 只记录,不抛错
 */
async function replayBatch(db, batchId, ops) {
  const sorted = [...ops].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  let success = 0;
  for (const op of sorted) {
    try {
      await replayOne(db, op);
      success += 1;
    } catch (e) {
      logger.warn('replay op fail', { opId: op.opId, type: op.type, e: e.message });
    }
  }
  return success;
}

async function replayOne(db, op) {
  // 落到统一的 behavior_logs(为后续分析)+ 业务表
  if (op.type === 'chat.message') {
    // 离线时发的聊天消息
    if (op.payload && op.payload.sessionId) {
      await db.collection('chat_messages').add({
        data: {
          sessionId: op.payload.sessionId,
          type: op.payload.type || 'text',
          from: op.payload.from || '',
          fromName: op.payload.fromName || '',
          fromRole: op.payload.fromRole || 'user',
          content: op.payload.content || '',
          rich: op.payload.rich || null,
          extra: op.payload.extra || null,
          clientMsgId: op.opId,
          offline: true,
          ts: op.ts,
          created: Date.now()
        }
      });
    }
  } else if (op.type === 'behavior.event') {
    // 离线时的行为埋点
    await db.collection('behavior_logs').add({
      data: Object.assign({
        offline: true,
        offlineBatchId: op.batchId,
        ts: op.ts,
        created: Date.now()
      }, op.payload || {})
    });
  } else if (op.type === 'order.action') {
    // 离线时的订单操作(取消/确认/支付)
    if (op.payload && op.payload.orderId) {
      await db.collection('order_audit').add({
        data: {
          orderId: op.payload.orderId,
          action: op.payload.action,
          by: op.payload.userId || '',
          offline: true,
          payload: op.payload,
          ts: op.ts
        }
      });
    }
  } else if (op.type === 'cart.update') {
    // 离线加购
    if (op.payload) {
      await db.collection('cart_offline').add({
        data: Object.assign({ offline: true, ts: op.ts }, op.payload)
      });
    }
  } else if (op.type === 'favor.toggle') {
    if (op.payload) {
      await db.collection('favor_offline').add({
        data: Object.assign({ offline: true, ts: op.ts }, op.payload)
      });
    }
  }
  // 其他未知 type 落 behavior_logs 即可
  else {
    await db.collection('behavior_logs').add({
      data: {
        type: 'offline_op_other',
        page: '',
        element: op.type,
        payload: op.payload || null,
        offline: true,
        ts: op.ts,
        created: Date.now()
      }
    });
  }
}

/**
 * 查询某客户端的离线操作记录
 */
async function queryByClient(db, params) {
  const w = {};
  if (params.clientId) w.clientId = params.clientId;
  if (params.tenantId) w.tenantId = params.tenantId;
  if (params.sessionId) w.sessionId = params.sessionId;
  if (params.reason) w.reason = params.reason;
  if (params.startTs || params.endTs) {
    w.createdAt = {};
    if (params.startTs) w.createdAt['$gte'] = params.startTs;
    if (params.endTs) w.createdAt['$lte'] = params.endTs;
  }
  const coll = db.collection('offline_op_batches');
  const total = await coll.where(w).count().then(r => r.total);
  const list = await coll
    .where(w)
    .orderBy('createdAt', 'desc')
    .skip(((num(params.page, 1)) - 1) * num(params.size, 20))
    .limit(Math.min(num(params.size, 20), 200))
    .get().then(r => r.data);
  return { total, list };
}

module.exports = {
  MAX_OPS_PER_BATCH,
  MAX_OP_PAYLOAD,
  acceptBatch,
  replayBatch,
  replayOne,
  queryByClient
};
