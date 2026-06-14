// orderRiskCheck - 订单可疑检测
// 触发: 退款 / 大额 / 风控规则命中
// 给客服 / 风控 / 商家用
const { cloud, ok, fail, auth } = require('../common/index.js');

const CHECKS = [
  {
    code: 'AMOUNT_OUTLIER',
    desc: '金额异常偏离(超出该用户历史平均 5 倍以上)',
    run: async (db, order, user) => {
      const _ = db.command;
      const his = await db.collection('orders')
        .where({ _userId: order._userId, _id: _.neq(order._id) })
        .limit(50)
        .get();
      if (his.data.length < 3) return false;
      const avg = his.data.reduce((s, o) => s + (o.totalPrice || 0), 0) / his.data.length;
      return order.totalPrice > avg * 5 && order.totalPrice > 500;
    },
    score: 25
  },
  {
    code: 'PAY_AND_REFUND_QUICK',
    desc: '下单后立即申请退款',
    run: async (db, order) => {
      if (order.refundStatus !== 1) return false;
      const payTime = order.payTime || 0;
      const refundApply = order.refundApplyTime || Date.now();
      return (refundApply - payTime) < 5 * 60 * 1000 && payTime > 0;
    },
    score: 30
  },
  {
    code: 'HIGH_FREQ',
    desc: '短期内高频下单',
    run: async (db, order) => {
      const since = Date.now() - 1 * 86400000;
      const cnt = await db.collection('orders')
        .where({ _userId: order._userId, createTime: db.command.gt(since) })
        .count();
      return cnt.total >= 5;
    },
    score: 20
  },
  {
    code: 'ADDRESS_CHANGE_OFTEN',
    desc: '收货地址短期内多次变更',
    run: async (db, order) => {
      const cnt = await db.collection('orders')
        .where({ _userId: order._userId })
        .limit(10)
        .get();
      const addrs = new Set(cnt.data.map(o => o.address && o.address.address).filter(Boolean));
      return addrs.size >= 5;
    },
    score: 15
  },
  {
    code: 'NEW_ACCOUNT_HIGH_AMOUNT',
    desc: '新账户高额订单',
    run: async (db, order, user) => {
      const regDays = (Date.now() - (user.createTime || 0)) / 86400000;
      return regDays < 3 && order.totalPrice >= 1000;
    },
    score: 35
  },
  {
    code: 'SAME_DEVICE_HIS_FRAUD',
    desc: '同设备历史欺诈记录',
    run: async (db, order, user) => {
      if (!user.lastDeviceId) return false;
      const fraud = await db.collection('users')
        .where({ lastDeviceId: user.lastDeviceId, blacklisted: true })
        .limit(1)
        .get();
      return fraud.data.length > 0;
    },
    score: 50
  },
  {
    code: 'IP_BLACKLIST',
    desc: 'IP 在黑名单',
    run: async (db, order, user) => {
      if (!user.lastIp) return false;
      const ip = await db.collection('ipBlacklist').where({ ip: user.lastIp }).limit(1).get();
      return ip.data.length > 0;
    },
    score: 60
  }
];

exports.main = auth(async (event) => {
  const { orderId } = event;
  if (!orderId) return fail('orderId 必填');

  const db = cloud.database();
  const _ = db.command;

  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) return fail('订单不存在', -404);
  const o = order.data;

  const user = o._userId ? await db.collection('users').doc(o._userId).get() : null;
  const u = user ? user.data : {};

  // 跑所有规则
  const factors = [];
  let total = 0;
  for (const c of CHECKS) {
    let hit = false;
    try { hit = await c.run(db, o, u); } catch (e) { hit = false; }
    if (hit) {
      factors.push({ code: c.code, desc: c.desc, score: c.score });
      total += c.score;
    }
  }
  total = Math.min(100, total);
  const level = total >= 60 ? 'high' : total >= 30 ? 'medium' : 'low';

  // 自动处置建议
  const suggestion = total >= 60 ? '建议拦截 / 人工审核' :
                     total >= 30 ? '建议加强验证(电话二次确认)' :
                     '正常放行';

  // 写风控日志
  await db.collection('riskLogs').add({
    data: {
      type: 'order',
      orderId: o._id,
      _userId: o._userId,
      score: total,
      level,
      factors,
      suggestion,
      operatorId: event._userId,
      createTime: Date.now()
    }
  });

  return ok({
    orderId: o._id,
    orderNo: o.orderNo,
    amount: o.totalPrice,
    riskScore: total,
    riskLevel: level,
    factors,
    suggestion,
    checkTime: Date.now()
  });
});
