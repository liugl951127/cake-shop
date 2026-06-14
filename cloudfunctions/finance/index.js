// finance - 财务系统
// action:  overview / commission / withdraw / withdrawList / reconcile / withdrawApprove
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

const COMMISSION_RATE = 0.05;  // 平台佣金 5%(分销)
const MIN_WITHDRAW = 100;     // 最低提现 100 元

exports.main = auth(async (event) => {
  const { action = 'overview' } = event;
  switch (action) {
    case 'overview': return overview(event);
    case 'commission': return commission(event);
    case 'withdraw': return withdraw(event);
    case 'withdrawList': return withdrawList(event);
    case 'withdrawApprove': return withdrawApprove(event);
    case 'reconcile': return reconcile(event);
    case 'account': return account(event);
    default: return fail('未知 action');
  }
});

async function overview(event) {
  const { shopId = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const todayStart = new Date(new Date().toDateString()).getTime();
  const monthStart = new Date(new Date().toISOString().slice(0, 7) + '-01').getTime();

  const where = { status: _.gte(3) };
  if (shopId) where.shopId = shopId;

  // 已完成订单
  const allDone = await db.collection('orders').where(where).limit(2000).get();
  const totalRevenue = allDone.data.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const totalCommission = totalRevenue * COMMISSION_RATE;
  const totalSettlement = totalRevenue - totalCommission;

  const todayDone = allDone.data.filter(o => o.payTime >= todayStart);
  const monthDone = allDone.data.filter(o => o.payTime >= monthStart);

  // 退款
  const refunds = await db.collection('orders').where({ ...where, status: -2 }).limit(200).get();
  const totalRefund = refunds.data.reduce((s, o) => s + (o.totalPrice || 0), 0);

  // 待结算(已完成但未提现)
  const settledIds = (await db.collection('settlements').limit(1000).get()).data.map(s => s.orderId);
  const pendingOrders = allDone.data.filter(o => !settledIds.includes(o._id));
  const pendingAmount = pendingOrders.reduce((s, o) => s + (o.totalPrice || 0), 0);

  return ok({
    total: {
      revenue: Number(totalRevenue.toFixed(2)),
      commission: Number(totalCommission.toFixed(2)),
      settlement: Number(totalSettlement.toFixed(2)),
      refund: Number(totalRefund.toFixed(2))
    },
    today: {
      revenue: Number(todayDone.reduce((s, o) => s + (o.totalPrice || 0), 0).toFixed(2)),
      count: todayDone.length
    },
    month: {
      revenue: Number(monthDone.reduce((s, o) => s + (o.totalPrice || 0), 0).toFixed(2)),
      count: monthDone.length
    },
    pending: {
      amount: Number(pendingAmount.toFixed(2)),
      count: pendingOrders.length
    }
  });
}

// 佣金明细
async function commission(event) {
  const { month = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const m = month || new Date().toISOString().slice(0, 7);
  const monthStart = new Date(m + '-01').getTime();
  const monthEnd = new Date(new Date(m + '-01').getTime() + 31 * 86400000).getTime();

  const orders = await db.collection('orders')
    .where({ status: _.gte(3), payTime: _.gte(monthStart).and(_.lt(monthEnd)) })
    .limit(2000)
    .get();

  // 按店铺聚合
  const byShop = {};
  for (const o of orders.data) {
    const s = o.shopId || 'default';
    if (!byShop[s]) byShop[s] = { shopId: s, count: 0, amount: 0, commission: 0 };
    byShop[s].count++;
    byShop[s].amount += o.totalPrice || 0;
    byShop[s].commission = Number((byShop[s].amount * COMMISSION_RATE).toFixed(2));
  }
  return ok({ month: m, list: Object.values(byShop) });
}

// 申请提现
async function withdraw(event) {
  const { amount = 0, method = 'wxpay', account = '' } = event;
  if (amount < MIN_WITHDRAW) return fail(`最低提现 ${MIN_WITHDRAW} 元`);
  if (amount > 50000) return fail('单次提现不可超过 50000');
  if (!account) return fail('提现账号必填');

  const db = cloud.database();
  const now = Date.now();

  // 计算可提现余额(已完成订单 - 已提现 - 已申请)
  const allDone = await db.collection('orders').where({ _userId: event._userId, status: 3 }).limit(2000).get();
  const totalAvailable = allDone.data.reduce((s, o) => s + (o.totalPrice || 0), 0);

  const withdrawed = await db.collection('withdraws')
    .where({ _userId: event._userId, status: _.in([0, 1, 2]) })
    .get();
  const locked = withdrawed.data.reduce((s, w) => s + (w.amount || 0), 0);
  const realAvailable = totalAvailable - locked;

  if (amount > realAvailable) return fail(`可提现余额 ${realAvailable.toFixed(2)} 元,不足`);

  const withdraw = {
    _openid: event._openid,
    _userId: event._userId,
    amount: Number(amount),
    method, account,
    status: 0,    // 0-待审核 1-处理中 2-已完成 -1-拒绝
    auditBy: '',
    auditNote: '',
    auditTime: 0,
    payTime: 0,
    transactionId: '',
    fee: 0,        // 手续费
    realAmount: Number(amount),  // 实际到账
    createTime: now,
    updateTime: now
  };
  const res = await db.collection('withdraws').add({ data: withdraw });
  await audit.write(event, 'withdraw_apply', 'withdraw', res._id, { amount, method });
  return ok({ id: res._id, realAvailable: Number(realAvailable.toFixed(2)) });
}

async function withdrawList(event) {
  const { status = -999, page = 1, pageSize = 20 } = event;
  const db = cloud.database();
  const _ = db.command;
  const where = { _userId: event._userId };
  if (status !== -999) where.status = status;
  const res = await db.collection('withdraws')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}

async function withdrawApprove(event) {
  const { id, action = 'approve', note = '' } = event;
  if (!id) return fail('id 必填');
  if (!['approve', 'reject', 'pay'].includes(action)) return fail('action 错误');

  const db = cloud.database();
  const w = await db.collection('withdraws').doc(id).get();
  if (!w.data) return fail('记录不存在', -404);
  const now = Date.now();
  const update = { updateTime: now, auditBy: event._userId, auditNote: note };
  if (action === 'approve') {
    if (w.data.status !== 0) return fail('仅待审核可审批');
    update.status = 1;
  } else if (action === 'reject') {
    if (w.data.status !== 0 && w.data.status !== 1) return fail('当前状态不可拒绝');
    update.status = -1;
  } else if (action === 'pay') {
    if (w.data.status !== 1) return fail('仅审批后可标记已付款');
    update.status = 2;
    update.payTime = now;
    update.transactionId = 'manual_' + now;
  }
  await db.collection('withdraws').doc(id).update({ data: update });
  await audit.write(event, 'withdraw_' + action, 'withdraw', id, { note });
  return ok({ ok: true });
}

// 对账(每日任务)
async function reconcile(event) {
  const { date = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const d = date || new Date().toISOString().slice(0, 10);
  const dStart = new Date(d).getTime();
  const dEnd = dStart + 86400000;

  // 平台流水 vs 微信支付流水
  const orders = await db.collection('orders')
    .where({ createTime: _.gte(dStart).and(_.lt(dEnd)), status: _.gte(1) })
    .get();
  const orderAmount = orders.data.reduce((s, o) => s + (o.totalPrice || 0), 0);

  const refunds = await db.collection('orders')
    .where({ createTime: _.gte(dStart).and(_.lt(dEnd)), status: -2 })
    .get();
  const refundAmount = refunds.data.reduce((s, o) => s + (o.totalPrice || 0), 0);

  // 提现
  const withdraws = await db.collection('withdraws')
    .where({ createTime: _.gte(dStart).and(_.lt(dEnd)) })
    .get();
  const withdrawAmount = withdraws.data
    .filter(w => w.status === 2)
    .reduce((s, w) => s + (w.amount || 0), 0);

  // 写对账记录
  const now = Date.now();
  const r = await db.collection('reconciliations').add({
    data: {
      date: d,
      orderCount: orders.data.length,
      orderAmount: Number(orderAmount.toFixed(2)),
      refundCount: refunds.data.length,
      refundAmount: Number(refundAmount.toFixed(2)),
      withdrawCount: withdraws.data.filter(w => w.status === 2).length,
      withdrawAmount: Number(withdrawAmount.toFixed(2)),
      net: Number((orderAmount - refundAmount - withdrawAmount).toFixed(2)),
      status: 'pending',
      createTime: now
    }
  }).catch(() => ({ _id: null }));

  return ok({
    id: r._id,
    date: d,
    orderAmount: Number(orderAmount.toFixed(2)),
    orderCount: orders.data.length,
    refundAmount: Number(refundAmount.toFixed(2)),
    refundCount: refunds.data.length,
    withdrawAmount: Number(withdrawAmount.toFixed(2)),
    net: Number((orderAmount - refundAmount - withdrawAmount).toFixed(2))
  });
}

async function account(event) {
  const db = cloud.database();
  const _ = db.command;

  // 累计已结算
  const orders = await db.collection('orders').where({ _userId: event._userId, status: 3 }).limit(2000).get();
  const total = orders.data.reduce((s, o) => s + (o.totalPrice || 0), 0);

  // 锁定中
  const w = await db.collection('withdraws').where({ _userId: event._userId, status: _.in([0, 1]) }).get();
  const locked = w.data.reduce((s, x) => s + (x.amount || 0), 0);

  // 已提现
  const wd = await db.collection('withdraws').where({ _userId: event._userId, status: 2 }).get();
  const withdrawn = wd.data.reduce((s, x) => s + (x.amount || 0), 0);

  // 佣金扣减
  const commission = total * COMMISSION_RATE;
  const available = total - commission - locked - withdrawn;

  return ok({
    total: Number(total.toFixed(2)),
    commission: Number(commission.toFixed(2)),
    locked: Number(locked.toFixed(2)),
    withdrawn: Number(withdrawn.toFixed(2)),
    available: Number(Math.max(0, available).toFixed(2)),
    minWithdraw: MIN_WITHDRAW
  });
}
