// blacklist 规则集
async function hit(db, key, value) {
  if (!value) return { hit: false };
  const r = await db.collection('blacklist').where({ [key]: value, status: 1 }).limit(1).get();
  if (r.data[0]) {
    return { hit: true, detail: `${key}=${value} 在黑名单:${r.data[0].reason || ''}` };
  }
  return { hit: false };
}

module.exports = {
  user: async (ctx) => {
    return hit(ctx.db, 'targetType_targetId', 'user_' + ctx.userId);
  },
  device: async (ctx) => {
    return hit(ctx.db, 'targetType_targetId', 'device_' + ctx.deviceId);
  },
  ip: async (ctx) => {
    return hit(ctx.db, 'targetValue', ctx.ip);
  },
  phone: async (ctx) => {
    return hit(ctx.db, 'targetValue', ctx.phone);
  },
  idcard: async (ctx) => {
    return hit(ctx.db, 'targetValue', ctx.idCardHash);
  }
};
