// cloudfunctions/adminFinance/index.js
// 财务管理(后台): 结算/提现/账单/流水
//   action: 'overview' | 'withdrawList' | 'withdrawApprove' | 'withdrawReject' |
//           'settleList' | 'settleMerchant' | 'billList' | 'ledger' | 'exportBill'
const { cloud, ok, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

const VALID_ACTIONS = ['overview', 'withdrawList', 'withdrawApprove', 'withdrawReject',
                       'settleList', 'settleMerchant', 'billList', 'ledger', 'exportBill'];

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { action } = event;
  if (!VALID_ACTIONS.includes(action)) throw new BizError('action 必填', ErrorCode.BAD_REQUEST);
  const db = cloud.database();
  const now = Date.now();
  const _ = db.command;

  switch (action) {
    case 'overview': {
      // 收入/支出/利润概览
      const startTime = Number(event.startTime || now - 30 * 86400 * 1000);
      const endTime = Number(event.endTime || now);
      const orders = await db.collection('orders').where({
        createTime: _.and(_.gte(startTime), _.lte(endTime)),
        status: _.gte(3)         // 已付款/已发货/已完成
      }).field({ payAmount: true, total: true, status: true, refundAmount: true }).limit(2000).get();
      let revenue = 0, cost = 0, refund = 0, net = 0;
      const byDay = {};
      for (const o of (orders.data || [])) {
        const amt = Number(o.payAmount || o.total || 0);
        revenue += amt;
        refund += Number(o.refundAmount || 0);
        const day = new Date(o.createTime || now).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + amt;
      }
      net = revenue - refund;
      return ok({
        revenue: +revenue.toFixed(2),
        refund: +refund.toFixed(2),
        net: +net.toFixed(2),
        orderCount: orders.data ? orders.data.length : 0,
        byDay,
        range: { startTime, endTime }
      });
    }

    case 'withdrawList': {
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 20), 100);
      const where = {};
      if (event.status !== undefined && event.status !== '') where.status = Number(event.status);
      if (event.userId) where.userId = event.userId;
      const res = await db.collection('withdraws').where(where)
        .orderBy('applyTime', 'desc')
        .skip((page - 1) * size).limit(size).get();
      const cnt = await db.collection('withdraws').where(where).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'withdrawApprove': {
      const id = event.id;
      if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);
      const w = await db.collection('withdraws').doc(id).get();
      if (!w.data) throw new BizError('记录不存在', ErrorCode.NOT_FOUND);
      if (w.data.status !== 0) throw new BizError('非待审核状态', ErrorCode.BAD_REQUEST);
      await db.collection('withdraws').doc(id).update({
        data: {
          status: 1,
          approveTime: now,
          approver: event.adminId || event._openid,
          updateTime: now
        }
      });
      // 走 wechatpay 提现接口(转账到零钱)
      try {
        await cloud.callFunction({
          name: 'wechatpayTransfer',
          data: { withdrawId: id, amount: w.data.amount, openid: w.data.openid }
        });
      } catch (e) {}
      await _audit(db, event, 'finance.withdraw.approve', id, { amount: w.data.amount });
      return ok({ id, status: 1 });
    }

    case 'withdrawReject': {
      const id = event.id;
      if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);
      const reason = event.reason || '';
      await db.collection('withdraws').doc(id).update({
        data: {
          status: -1, rejectReason: reason,
          rejectTime: now, rejectBy: event.adminId || event._openid,
          updateTime: now
        }
      });
      // 余额返还
      const w = await db.collection('withdraws').doc(id).get();
      if (w && w.data && w.data.userId) {
        await db.collection('members').where({ userId: w.data.userId }).update({
          data: { balance: _.inc(Number(w.data.amount || 0)) }
        }).catch(() => {});
      }
      await _audit(db, event, 'finance.withdraw.reject', id, { reason });
      return ok({ id, status: -1 });
    }

    case 'settleList': {
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 20), 100);
      const where = {};
      if (event.merchantId) where.merchantId = event.merchantId;
      if (event.status !== undefined && event.status !== '') where.status = Number(event.status);
      const res = await db.collection('merchant_settles').where(where)
        .orderBy('periodEnd', 'desc')
        .skip((page - 1) * size).limit(size).get();
      const cnt = await db.collection('merchant_settles').where(where).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'settleMerchant': {
      // 结算单个商家
      const { merchantId, periodStart, periodEnd } = event;
      if (!merchantId) throw new BizError('merchantId 必填', ErrorCode.BAD_REQUEST);
      const start = Number(periodStart || now - 7 * 86400 * 1000);
      const end = Number(periodEnd || now);
      const orders = await db.collection('orders').where({
        merchantId, status: 4,
        completeTime: _.and(_.gte(start), _.lte(end))
      }).field({ payAmount: true, commission: true }).limit(1000).get();
      let total = 0, commission = 0;
      for (const o of (orders.data || [])) {
        total += Number(o.payAmount || 0);
        commission += Number(o.commission || 0);
      }
      const net = total - commission;
      const r = await db.collection('merchant_settles').add({
        data: {
          merchantId, periodStart: start, periodEnd: end,
          totalAmount: +total.toFixed(2),
          commissionAmount: +commission.toFixed(2),
          netAmount: +net.toFixed(2),
          orderCount: orders.data ? orders.data.length : 0,
          status: 0,
          createTime: now,
          createBy: event.adminId || event._openid
        }
      });
      await _audit(db, event, 'finance.settle.merchant', r.id, { merchantId, net });
      return ok({ id: r.id, total: +total.toFixed(2), commission: +commission.toFixed(2), net: +net.toFixed(2) });
    }

    case 'billList': {
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 20), 100);
      const where = { type: event.type || 'income' };
      if (event.userId) where.userId = event.userId;
      if (event.startTime) where.ts = _.gte(Number(event.startTime));
      if (event.endTime) where.ts = _.lte(Number(event.endTime));
      const res = await db.collection('bills').where(where)
        .orderBy('ts', 'desc')
        .skip((page - 1) * size).limit(size).get();
      const cnt = await db.collection('bills').where(where).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'ledger': {
      // 账户流水
      const userId = event.userId;
      if (!userId) throw new BizError('userId 必填', ErrorCode.BAD_REQUEST);
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 20), 100);
      const res = await db.collection('bills').where({ userId })
        .orderBy('ts', 'desc')
        .skip((page - 1) * size).limit(size).get();
      return ok({ list: res.data || [], page, size });
    }

    case 'exportBill': {
      // 异步: 写 export 任务
      const r = await db.collection('export_tasks').add({
        data: {
          type: 'bill',
          status: 0,
          params: event,
          createTime: now,
          createBy: event.adminId || event._openid
        }
      });
      return ok({ taskId: r.id });
    }
  }
});

async function _audit(db, event, action, resourceId, payload) {
  try {
    await db.collection('audit_logs').add({
      data: {
        action, resourceType: 'finance', resourceId,
        payload, adminId: event.adminId || '',
        adminName: event.adminName || '',
        tenantId: event.tenantId || 'default', ts: Date.now()
      }
    });
  } catch (e) {}
}
