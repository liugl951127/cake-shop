// auth 规则集 - 身份认证门控
// 根据场景 + 金额,判断需要哪一档认证
const _ = null;

module.exports = {
  // 未实名: 高金额 / 提现 必须实名
  realName: async (ctx) => {
    if (!ctx.userId) return { hit: false };
    const u = await ctx.db.collection('users').doc(ctx.userId).get().catch(() => null);
    if (!u || !u.data) return { hit: false };
    if (u.data.realNameVerified) return { hit: false };
    // 提现 / 高额订单 / 客服加入必需要求
    if (['withdraw', 'highOrder', 'chatJoin'].includes(ctx.scenario)) {
      return { hit: true, detail: `${ctx.scenario} 需要实名` };
    }
    if (ctx.scenario === 'pay' && ctx.amount >= 1000) {
      return { hit: true, detail: `高额订单 ¥${ctx.amount} 需要实名` };
    }
    return { hit: false };
  },

  // 活体检测: 提现 / 大额必须
  liveness: async (ctx) => {
    if (!ctx.userId) return { hit: false };
    if (!['withdraw', 'highOrder'].includes(ctx.scenario)) return { hit: false };
    if (ctx.scenario === 'withdraw' && (ctx.amount || 0) < 500) return { hit: false };
    if (ctx.scenario === 'highOrder' && (ctx.amount || 0) < 2000) return { hit: false };
    const u = await ctx.db.collection('users').doc(ctx.userId).get().catch(() => null);
    if (u && u.data && u.data.livenessVerified) return { hit: false };
    return { hit: true, detail: `${ctx.scenario} 金额 ¥${ctx.amount} 需要活体` };
  },

  // 银行卡四要素: 提现必须
  bankCard: async (ctx) => {
    if (ctx.scenario !== 'withdraw') return { hit: false };
    if (!ctx.userId) return { hit: false };
    const u = await ctx.db.collection('users').doc(ctx.userId).get().catch(() => null);
    if (u && u.data && u.data.bankVerified) return { hit: false };
    return { hit: true, detail: '提现需要绑定银行卡' };
  }
};
