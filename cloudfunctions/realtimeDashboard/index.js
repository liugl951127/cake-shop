// realtimeDashboard - 实时数据看板
// 给商家看:营业额/订单/转化/热点
// 每分钟刷新,关键指标用增量计算
const { cloud, ok, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const todayStart = new Date(new Date().toDateString()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last30Start = todayStart - 30 * 86400000;
  const last7Start = todayStart - 7 * 86400000;
  const lastHour = now - 3600000;
  const last5Min = now - 5 * 60000;

  // 1. 今日销售
  const todayOrders = await db.collection('orders')
    .where({ createTime: _.gte(todayStart), status: _.gte(1) })
    .limit(1000)
    .get();
  const todayAmount = todayOrders.data.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const todayCount = todayOrders.data.length;

  // 2. 昨日同期(对比)
  const yesterdayOrders = await db.collection('orders')
    .where({ createTime: _.gte(yesterdayStart).and(_.lt(todayStart)), status: _.gte(1) })
    .limit(1000)
    .get();
  const yesterdayAmount = yesterdayOrders.data.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const dayOverDay = yesterdayAmount > 0
    ? Number(((todayAmount - yesterdayAmount) / yesterdayAmount * 100).toFixed(1))
    : 0;

  // 3. 7 日趋势(按天)
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const dStart = todayStart - i * 86400000;
    const dEnd = dStart + 86400000;
    const r = await db.collection('orders')
      .where({ createTime: _.gte(dStart).and(_.lt(dEnd)), status: _.gte(1) })
      .limit(500)
      .get();
    trend.push({
      date: new Date(dStart).toISOString().slice(5, 10),
      amount: Number(r.data.reduce((s, o) => s + (o.totalPrice || 0), 0).toFixed(2)),
      count: r.data.length
    });
  }

  // 4. 实时(5 分钟内下单)
  const realtimeOrders = await db.collection('orders')
    .where({ createTime: _.gte(last5Min) })
    .orderBy('createTime', 'desc')
    .limit(20)
    .get();

  // 5. 热卖 TOP 10
  const goodsSales = {};
  for (const o of todayOrders.data) {
    for (const g of (o.goods || [])) {
      const k = g.goodsId;
      goodsSales[k] = goodsSales[k] || { id: k, name: g.name || '商品', image: g.image || '', count: 0, amount: 0 };
      goodsSales[k].count += g.count || 0;
      goodsSales[k].amount += (g.price || 0) * (g.count || 0);
    }
  }
  const topGoods = Object.values(goodsSales).sort((a, b) => b.amount - a.amount).slice(0, 10);

  // 6. 7 日用户行为
  const newUsers = await db.collection('users')
    .where({ createTime: _.gte(todayStart) })
    .count();
  const newUsers7 = await db.collection('users')
    .where({ createTime: _.gte(last7Start) })
    .count();
  const activeUsers = await db.collection('orders')
    .where({ createTime: _.gte(last7Start), status: _.gte(1) })
    .field({ _userId: true })
    .get();
  const uniqueActive = new Set(activeUsers.data.map(o => o._userId)).size;

  // 7. 漏斗
  const funnel = await calcFunnel(db, _);

  // 8. 客服
  const chatOnline = await db.collection('agents').where({ online: true }).count();
  const chatActive = await db.collection('chatSessions').where({ status: 1 }).count();
  const chatPending = await db.collection('chatSessions').where({ status: 0 }).count();

  // 9. 营销活动效果
  const promoToday = await db.collection('orders')
    .where({ createTime: _.gte(todayStart), 'promo.id': _.exists(true) })
    .limit(200)
    .get();
  const promoSaved = promoToday.data.reduce((s, o) => s + (o.promoDiscount || 0), 0);
  const promoConversion = todayCount > 0 ? Number((promoToday.data.length / todayCount * 100).toFixed(1)) : 0;

  return ok({
    timestamp: now,
    realtime: {
      last5minOrders: realtimeOrders.data,
      last5minCount: realtimeOrders.data.length,
      onlineUsers: 0  // 由前端轮询上报
    },
    sales: {
      todayAmount: Number(todayAmount.toFixed(2)),
      todayCount,
      yesterdayAmount: Number(yesterdayAmount.toFixed(2)),
      dayOverDay,
      last30Amount: 0,  // 简化
      avgOrderAmount: todayCount > 0 ? Number((todayAmount / todayCount).toFixed(2)) : 0
    },
    trend,
    topGoods,
    users: {
      newToday: newUsers.total,
      new7Days: newUsers7.total,
      active7Days: uniqueActive
    },
    funnel,
    customerService: {
      onlineAgents: chatOnline.total,
      activeSessions: chatActive.total,
      pendingSessions: chatPending.total
    },
    marketing: {
      promoOrders: promoToday.data.length,
      promoConversion,
      promoSavedAmount: Number(promoSaved.toFixed(2))
    }
  });
});

async function calcFunnel(db, _) {
  // 浏览 → 加购 → 下单 → 支付 → 复购
  const today = new Date(new Date().toDateString()).getTime();
  const pv = await db.collection('accessLogs')
    .where({ createTime: _.gte(today), action: 'page_view' })
    .count();
  const addCart = await db.collection('carts')
    .where({ updateTime: _.gte(today) })
    .count();
  const orderCreate = await db.collection('orders')
    .where({ createTime: _.gte(today) })
    .count();
  const orderPaid = await db.collection('orders')
    .where({ createTime: _.gte(today), status: _.gte(1) })
    .count();
  const orderDone = await db.collection('orders')
    .where({ createTime: _.gte(today), status: _.gte(3) })
    .count();

  return [
    { name: '浏览', value: pv.total || 0 },
    { name: '加购', value: addCart.total || 0 },
    { name: '下单', value: orderCreate || 0 },
    { name: '支付', value: orderPaid || 0 },
    { name: '完成', value: orderDone || 0 }
  ];
}
