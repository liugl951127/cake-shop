// device 规则集 - 设备/IP
module.exports = {
  // 同设备多账号(≥ 3 个不同 userId)
  sameDeviceMulti: async (ctx) => {
    if (!ctx.deviceId) return { hit: false };
    const r = await ctx.db.collection('users')
      .where({ lastDeviceId: ctx.deviceId })
      .field({ _id: true })
      .limit(10)
      .get();
    if (r.data.length >= 3) {
      return { hit: true, detail: `设备 ${ctx.deviceId.slice(0, 8)}... 有 ${r.data.length} 个账号` };
    }
    return { hit: false };
  },

  // 同 IP 高频访问(7 天 ≥ 20)
  ipFrequent: async (ctx) => {
    if (!ctx.ip) return { hit: false };
    const since = Date.now() - 7 * 86400000;
    const r = await ctx.db.collection('accessLogs')
      .where({ ip: ctx.ip, createTime: ctx.db.command.gte(since) })
      .count();
    if (r.total >= 20) {
      return { hit: true, detail: `IP 7 天访问 ${r.total} 次` };
    }
    return { hit: false };
  },

  // IP 与历史城市不同(短时间跨城)
  ipDiffCity: async (ctx) => {
    if (!ctx.userId || !ctx.ip) return { hit: false };
    const u = await ctx.db.collection('users').doc(ctx.userId).get().catch(() => null);
    if (!u || !u.data || !u.data.lastIp) return { hit: false };
    if (u.data.lastIp === ctx.ip) return { hit: false };
    // 不同 IP(简化:看前 2 段)
    const a = u.data.lastIp.split('.').slice(0, 2).join('.');
    const b = ctx.ip.split('.').slice(0, 2).join('.');
    if (a !== b) {
      // 看最近登录时间(2 小时内异地)
      const lastTime = u.data.lastVisitTime || 0;
      if (Date.now() - lastTime < 2 * 3600 * 1000) {
        return { hit: true, detail: `2h 内从 ${u.data.lastIp} 到 ${ctx.ip}` };
      }
    }
    return { hit: false };
  }
};
