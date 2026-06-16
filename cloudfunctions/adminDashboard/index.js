// cloudfunctions/adminDashboard/index.js
// 后台仪表盘: 一次性聚合所有关键指标
//   涵盖: 订单/营收/商品/会员/客服/营销/财务/监控
const { cloud, ok, logger, auth, requireAdmin, BizError } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = todayStart + 86400 * 1000;
  const monthStart = new Date(now).setDate(1);
  monthStart === new Date(now).setHours(0, 0, 0, 0);

  // 并发拉
  const safe = async (p, fallback) => {
    try { return await p; } catch (e) { return fallback; }
  };

  const [todayRev, todayCount, totalGoods, totalMembers, todayNewMembers, pendingOrders, onlineAgents, openTickets, auditToday, errorToday] = await Promise.all([
    safe(db.collection('orders').where({
      createTime: _.and(_.gte(todayStart), _.lt(todayEnd)),
      status: _.gte(1)
    }).field({ payAmount: true }).limit(2000).get(), { data: [] }),
    safe(db.collection('orders').where({
      createTime: _.and(_.gte(todayStart), _.lt(todayEnd))
    }).count(), { total: 0 }),
    safe(db.collection('goods').where({ status: _.neq(-1) }).count(), { total: 0 }),
    safe(db.collection('members').count(), { total: 0 }),
    safe(db.collection('members').where({
      createTime: _.and(_.gte(todayStart), _.lt(todayEnd))
    }).count(), { total: 0 }),
    safe(db.collection('orders').where({ status: 1 }).count(), { total: 0 }),
    safe(db.collection('chat_agents').where({ status: 'online' }).count(), { total: 0 }),
    safe(db.collection('chat_sessions').where({ status: 'pending' }).count(), { total: 0 }),
    safe(db.collection('audit_logs').where({
      ts: _.and(_.gte(todayStart), _.lt(todayEnd))
    }).count(), { total: 0 }),
    safe(db.collection('error_logs').where({
      ts: _.and(_.gte(todayStart), _.lt(todayEnd))
    }).count(), { total: 0 })
  ]);

  let todayRevenue = 0;
  for (const o of (todayRev.data || [])) {
    todayRevenue += Number(o.payAmount || 0);
  }

  // 商品分类分布
  const catDist = await safe(
    db.collection('goods').where({ status: _.neq(-1) })
      .field({ category: true }).limit(1000).get(),
    { data: [] }
  );
  const catMap = {};
  for (const g of (catDist.data || [])) {
    const c = g.category || '其他';
    catMap[c] = (catMap[c] || 0) + 1;
  }

  // 7 天订单趋势
  const weekStart = now - 7 * 86400 * 1000;
  const weekOrders = await safe(
    db.collection('orders').where({
      createTime: _.and(_.gte(weekStart), _.lte(now))
    }).field({ payAmount: true, createTime: true, status: true }).limit(2000).get(),
    { data: [] }
  );
  const trend = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400 * 1000).toISOString().slice(0, 10);
    trend[d] = { count: 0, amount: 0 };
  }
  for (const o of (weekOrders.data || [])) {
    const d = new Date(o.createTime || now).toISOString().slice(0, 10);
    if (trend[d]) {
      trend[d].count++;
      if (Number(o.status) >= 1) trend[d].amount += Number(o.payAmount || 0);
    }
  }

  return ok({
    today: {
      revenue: +todayRevenue.toFixed(2),
      orderCount: todayCount.total,
      newMembers: todayNewMembers.total
    },
    total: {
      goods: totalGoods.total,
      members: totalMembers.total,
      auditToday: auditToday.total,
      errorToday: errorToday.total
    },
    pending: {
      orders: pendingOrders.total,
      tickets: openTickets.total,
      onlineAgents: onlineAgents.total
    },
    categoryDistribution: catMap,
    trend7d: trend,
    generatedAt: now
  });
});
