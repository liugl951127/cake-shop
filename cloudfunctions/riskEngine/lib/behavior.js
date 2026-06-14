// behavior 规则集 - 行为画像
module.exports = {
  // 新用户大额(注册 < 7 天 + 订单 ≥ 500)
  newUserHigh: async (ctx) => {
    if (!ctx.userId || ctx.scenario !== 'pay') return { hit: false };
    const u = await ctx.db.collection('users').doc(ctx.userId).get().catch(() => null);
    if (!u || !u.data) return { hit: false };
    const regDays = (Date.now() - (u.data.createTime || 0)) / 86400000;
    if (regDays >= 7) return { hit: false };
    if ((ctx.amount || 0) >= 500) {
      return { hit: true, detail: `新用户(${regDays.toFixed(1)}天)下大单 ¥${ctx.amount}` };
    }
    return { hit: false };
  },

  // 高频退款(近 30 天 ≥ 3 次)
  frequentRefund: async (ctx) => {
    if (!ctx.userId) return { hit: false };
    const r = await ctx.db.collection('orders')
      .where({ _userId: ctx.userId, status: -2 })
      .count();
    if (r.total >= 3) {
      return { hit: true, detail: `近 30 天退款 ${r.total} 次` };
    }
    return { hit: false };
  },

  // 深夜下单(1-5 点,3 单以上)
  nightOrder: async (ctx) => {
    if (!ctx.userId || ctx.scenario !== 'pay') return { hit: false };
    const since = Date.now() - 30 * 86400000;
    const r = await ctx.db.collection('orders')
      .where({ _userId: ctx.userId, createTime: ctx.db.command.gte(since) })
      .limit(50)
      .get();
    const nightCount = r.data.filter(o => {
      const h = new Date(o.createTime).getHours();
      return h >= 1 && h <= 5;
    }).length;
    if (nightCount >= 3) return { hit: true, detail: `近 30 天深夜下单 ${nightCount} 次` };
    return { hit: false };
  },

  // 收货地址异常(近 10 单 ≥ 5 个不同地址)
  abnormalAddress: async (ctx) => {
    if (!ctx.userId) return { hit: false };
    const r = await ctx.db.collection('orders')
      .where({ _userId: ctx.userId })
      .orderBy('createTime', 'desc')
      .limit(10)
      .get();
    const addrs = new Set(r.data.map(o => o.address && o.address.address).filter(Boolean));
    if (addrs.size >= 5) return { hit: true, detail: `近 10 单 ${addrs.size} 个不同地址` };
    return { hit: false };
  }
};
