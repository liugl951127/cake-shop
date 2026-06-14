// customerProfile - 客户联网核查(给坐席用)
// 输出:
//   基础信息: 用户画像
//   风险评分: 0-100,越高越可疑
//   同设备/同 IP 检测
//   行为画像: 订单/退款/评价
//   风险因素: 触发可疑的具体项
const { cloud, ok, fail, auth } = require('../common/index.js');

// 风险规则
const RISK_RULES = [
  {
    code: 'NEW_USER_HIGH_AMOUNT',
    desc: '新用户大额订单',
    check: (u, orders) => {
      const regDays = (Date.now() - (u.createTime || 0)) / 86400000;
      const highAmount = orders.some(o => o.totalPrice >= 500 && (Date.now() - o.createTime) < 7 * 86400000);
      return regDays < 7 && highAmount;
    },
    score: 30
  },
  {
    code: 'FREQUENT_REFUND',
    desc: '高频退款',
    check: (u, orders) => {
      const recentRefunds = orders.filter(o => o.status === -2 || o.refundStatus === 1).length;
      return recentRefunds >= 3;
    },
    score: 25
  },
  {
    code: 'SAME_DEVICE_MULTI',
    desc: '同设备多账号',
    check: async (u, ctx) => {
      return ctx.deviceUsers >= 3;
    },
    score: 35
  },
  {
    code: 'SAME_IP_FREQUENT',
    desc: '同 IP 高频访问',
    check: (u, ctx) => {
      return ctx.ipAccessCount >= 20;
    },
    score: 20
  },
  {
    code: 'NIGHT_ORDER',
    desc: '深夜频繁下单',
    check: (u, orders) => {
      const nightCount = orders.filter(o => {
        const h = new Date(o.createTime).getHours();
        return h >= 1 && h <= 5;
      }).length;
      return nightCount >= 3;
    },
    score: 15
  },
  {
    code: 'BLACKLIST',
    desc: '黑名单用户',
    check: (u) => u.blacklisted === true,
    score: 80
  },
  {
    code: 'UNVERIFIED_HIGH_AMOUNT',
    desc: '未实名大额',
    check: (u, orders) => {
      const highAmount = orders.some(o => o.totalPrice >= 1000);
      return highAmount && !u.realNameVerified;
    },
    score: 30
  }
];

exports.main = auth(async (event) => {
  const { _userId: targetId } = event;
  if (!targetId) return fail('userId 必填');

  const db = cloud.database();
  const _ = db.command;

  // 1. 用户基础
  const user = await db.collection('users').doc(targetId).get();
  if (!user.data) return fail('用户不存在', -404);
  const u = user.data;

  // 2. 订单统计
  const orders = await db.collection('orders').where({ _userId: targetId }).limit(200).get();
  const orderList = orders.data;
  const totalAmount = orderList.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const refundCount = orderList.filter(o => o.status === -2 || o.refundStatus === 1).length;

  // 3. 最近 10 单
  const recentOrders = orderList
    .sort((a, b) => b.createTime - a.createTime)
    .slice(0, 10);

  // 4. 同设备检测
  let deviceUsers = 0;
  if (u.lastDeviceId) {
    const sameDev = await db.collection('users')
      .where({ lastDeviceId: u.lastDeviceId })
      .count();
    deviceUsers = sameDev.total;
  }

  // 5. 同 IP 访问频次
  let ipAccessCount = 0;
  if (u.lastIp) {
    const since = Date.now() - 7 * 86400000;
    const ipAccess = await db.collection('accessLogs')
      .where({ ip: u.lastIp, createTime: _.gt(since) })
      .count();
    ipAccessCount = ipAccess.total;
  }

  // 6. 风险评估
  const ctx = { deviceUsers, ipAccessCount };
  const riskFactors = [];
  let totalScore = 0;
  for (const rule of RISK_RULES) {
    let triggered = false;
    try {
      triggered = await rule.check(u, ctx, orderList);
    } catch (e) {
      triggered = false;
    }
    if (triggered) {
      riskFactors.push({ code: rule.code, desc: rule.desc, score: rule.score });
      totalScore += rule.score;
    }
  }
  totalScore = Math.min(100, totalScore);
  const riskLevel = totalScore >= 70 ? 'high' : totalScore >= 40 ? 'medium' : 'low';

  // 7. 行为画像
  const last30 = orderList.filter(o => Date.now() - o.createTime < 30 * 86400000);
  const last30Amount = last30.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const avgOrderAmount = orderList.length > 0 ? totalAmount / orderList.length : 0;

  // 8. 评价行为
  const reviews = await db.collection('reviews').where({ _userId: targetId }).count();

  // 9. 客服历史
  const sessions = await db.collection('chatSessions').where({ _userId: targetId }).count();

  return ok({
    basic: {
      _id: u._id,
      openid: u.openid,
      nickName: u.nickName,
      avatarUrl: u.avatarUrl,
      phone: u.phone ? u.phone.replace(/^(\d{3})\d{4}/, '$1****') : '',
      level: u.level || '普通',
      points: u.points || 0,
      createTime: u.createTime,
      lastLoginTime: u.lastLoginTime,
      loginType: u.loginType,
      realNameVerified: u.realNameVerified || false,
      vip: u.vip || false
    },
    orders: {
      total: orderList.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      avgAmount: Number(avgOrderAmount.toFixed(2)),
      last30Count: last30.length,
      last30Amount: Number(last30Amount.toFixed(2)),
      refundCount,
      cancelCount: orderList.filter(o => o.status === 0).length
    },
    behavior: {
      reviewCount: reviews.total,
      chatCount: sessions.total,
      deviceUsers,
      ipAccessCount,
      lastDeviceId: u.lastDeviceId ? u.lastDeviceId.slice(0, 8) + '...' : '',
      lastIp: u.lastIp ? u.lastIp.replace(/\.\d+$/, '.***') : ''
    },
    risk: {
      score: totalScore,
      level: riskLevel,
      factors: riskFactors
    },
    recentOrders: recentOrders.map(o => ({
      _id: o._id,
      orderNo: o.orderNo,
      totalPrice: o.totalPrice,
      status: o.status,
      createTime: o.createTime
    })),
    // 提醒坐席
    notices: riskFactors.length > 0 ? riskFactors.map(f => f.desc) : ['暂无风险因素']
  });
});
