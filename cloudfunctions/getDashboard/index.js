// getDashboard - 数据看板(管理员)
// 概览:今日/本周/本月/累计 - 订单数/销售额/用户数/转化率
const { cloud, ok, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const db = cloud.database();
  const _ = db.command;
  const now = new Date();

  // 时间范围
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - now.getDay() * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  // 概览统计
  const [
    totalUsers,
    totalOrders,
    todayOrders,
    weekOrders,
    monthOrders,
    paidOrders,
    pendingOrders
  ] = await Promise.all([
    db.collection('users').count(),
    db.collection('orders').where({ status: _.gte(1) }).count(),
    db.collection('orders').where({ status: _.gte(1), createTime: _.gte(startOfDay) }).count(),
    db.collection('orders').where({ status: _.gte(1), createTime: _.gte(startOfWeek) }).count(),
    db.collection('orders').where({ status: _.gte(1), createTime: _.gte(startOfMonth) }).count(),
    db.collection('orders').where({ status: _.gte(1) }).limit(1000).get(),
    db.collection('orders').where({ status: 0 }).count()
  ]);

  // 销售额(已付款)
  const calcSales = (orders) => orders.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
  const paidList = paidOrders.data || [];
  const todayPaid = paidList.filter(o => o.createTime >= startOfDay);
  const weekPaid = paidList.filter(o => o.createTime >= startOfWeek);
  const monthPaid = paidList.filter(o => o.createTime >= startOfMonth);

  // 近 7 天销售趋势
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = startOfDay - i * 86400000;
    const next = d + 86400000;
    const dayOrders = paidList.filter(o => o.createTime >= d && o.createTime < next);
    trend.push({
      date: new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      amount: calcSales(dayOrders),
      count: dayOrders.length
    });
  }

  // 热销商品 Top 10
  const allGoods = await db.collection('goods').orderBy('sales', 'desc').limit(10).get();
  const hotGoods = allGoods.data.map(g => ({
    _id: g._id, name: g.name, sales: g.sales || 0, image: g.image, price: g.price
  }));

  // 订单状态分布
  const allStatusOrders = await db.collection('orders').limit(1000).get();
  const statusDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '-1': 0, '-2': 0 };
  for (const o of allStatusOrders.data) {
    const k = String(o.status);
    statusDist[k] = (statusDist[k] || 0) + 1;
  }

  // 转化漏斗
  const viewCount = await db.collection('behaviors').where({ action: 'view' }).count();
  const cartCount = await db.collection('behaviors').where({ action: 'cart' }).count();
  const orderCount = await db.collection('behaviors').where({ action: 'order' }).count();

  return ok({
    overview: {
      totalUsers: totalUsers.total,
      totalOrders: totalOrders.total,
      todayOrders: todayOrders.total,
      weekOrders: weekOrders.total,
      monthOrders: monthOrders.total,
      todaySales: calcSales(todayPaid),
      weekSales: calcSales(weekPaid),
      monthSales: calcSales(monthPaid),
      totalSales: calcSales(paidList),
      pendingOrders: pendingOrders.total
    },
    trend,
    hotGoods,
    statusDist,
    conversion: {
      view: viewCount.total,
      cart: cartCount.total,
      order: orderCount.total,
      cartRate: viewCount.total > 0 ? (cartCount.total / viewCount.total * 100).toFixed(1) : 0,
      orderRate: cartCount.total > 0 ? (orderCount.total / cartCount.total * 100).toFixed(1) : 0
    }
  });
});
