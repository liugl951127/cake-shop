// cloudfunctions/adminMonitor/index.js
// 监控/统计(后台): 性能/异常/审计/告警
//   action: 'overview' | 'perf' | 'errors' | 'audit' | 'fingerprint' | 'alertList' | 'alertResolve'
const { cloud, ok, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

const VALID_ACTIONS = ['overview', 'perf', 'errors', 'audit', 'fingerprint', 'alertList', 'alertResolve'];

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { action } = event;
  if (!VALID_ACTIONS.includes(action)) throw new BizError('action 必填', ErrorCode.BAD_REQUEST);
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const startTime = Number(event.startTime || now - 24 * 3600 * 1000);
  const endTime = Number(event.endTime || now);

  switch (action) {
    case 'overview': {
      // 核心指标: PV/UV/订单/异常/告警
      const [pvs, uvs, orders, errors, alerts] = await Promise.all([
        db.collection('behavior_logs').where({
          type: 'page_view', ts: _.and(_.gte(startTime), _.lte(endTime))
        }).count().catch(() => ({ total: 0 })),
        db.collection('behavior_logs').where({
          type: 'page_view', ts: _.and(_.gte(startTime), _.lte(endTime))
        }).count().catch(() => ({ total: 0 })),
        db.collection('orders').where({
          createTime: _.and(_.gte(startTime), _.lte(endTime))
        }).count().catch(() => ({ total: 0 })),
        db.collection('error_logs').where({
          ts: _.and(_.gte(startTime), _.lte(endTime))
        }).count().catch(() => ({ total: 0 })),
        db.collection('alerts').where({
          status: 0, ts: _.and(_.gte(startTime), _.lte(endTime))
        }).count().catch(() => ({ total: 0 }))
      ]);
      return ok({
        pv: pvs.total,
        uv: uvs.total,
        orderCount: orders.total,
        errorCount: errors.total,
        alertCount: alerts.total,
        range: { startTime, endTime }
      });
    }

    case 'perf': {
      // 性能数据: P50/P90/P99
      const metrics = await db.collection('perf_logs').where({
        ts: _.and(_.gte(startTime), _.lte(endTime))
      }).field({ duration: true, path: true, ts: true }).limit(5000).get();
      const arr = (metrics.data || []).map(m => m.duration).filter(x => typeof x === 'number').sort((a, b) => a - b);
      const p = (q) => arr.length ? arr[Math.floor(arr.length * q)] : 0;
      return ok({
        samples: arr.length,
        p50: p(0.5), p90: p(0.9), p99: p(0.99),
        avg: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
        max: arr[arr.length - 1] || 0
      });
    }

    case 'errors': {
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 30), 100);
      const where = { ts: _.and(_.gte(startTime), _.lte(endTime)) };
      if (event.severity) where.severity = Number(event.severity);
      const res = await db.collection('error_logs').where(where)
        .orderBy('ts', 'desc')
        .skip((page - 1) * size).limit(size).get();
      const cnt = await db.collection('error_logs').where(where).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'audit': {
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 30), 100);
      const where = {};
      if (event.adminId) where.adminId = event.adminId;
      if (event.action) where.action = new db.RegExp({ regexp: event.action, options: 'i' });
      if (event.resourceType) where.resourceType = event.resourceType;
      if (event.startTime) where.ts = _.gte(Number(event.startTime));
      if (event.endTime) where.ts = _.lte(Number(event.endTime));
      const res = await db.collection('audit_logs').where(where)
        .orderBy('ts', 'desc')
        .skip((page - 1) * size).limit(size).get();
      const cnt = await db.collection('audit_logs').where(where).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'fingerprint': {
      // 设备指纹聚合
      const res = await db.collection('device_fingerprints')
        .where({ ts: _.and(_.gte(startTime), _.lte(endTime)) })
        .limit(1000)
        .get();
      // 聚合同一 fp 的统计
      const map = {};
      for (const d of (res.data || [])) {
        const fp = d.fingerprint || d.deviceId || 'unknown';
        if (!map[fp]) {
          map[fp] = { fingerprint: fp, count: 0, firstTs: d.ts, lastTs: d.ts, devices: [] };
        }
        map[fp].count++;
        map[fp].lastTs = Math.max(map[fp].lastTs, d.ts || 0);
        map[fp].firstTs = Math.min(map[fp].firstTs, d.ts || now);
        if (map[fp].devices.length < 5 && d.model) map[fp].devices.push(d.model);
      }
      const list = Object.values(map).sort((a, b) => b.count - a.count).slice(0, 50);
      return ok({ list });
    }

    case 'alertList': {
      const where = {};
      if (event.status !== undefined) where.status = Number(event.status);
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 30), 100);
      const res = await db.collection('alerts').where(where)
        .orderBy('ts', 'desc')
        .skip((page - 1) * size).limit(size).get();
      return ok({ list: res.data || [], page, size });
    }

    case 'alertResolve': {
      const id = event.id;
      if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);
      await db.collection('alerts').doc(id).update({
        data: {
          status: 1,
          resolveTime: now,
          resolveBy: event.adminId || event._openid,
          resolveNote: event.note || ''
        }
      });
      return ok({ resolved: id });
    }
  }
});
