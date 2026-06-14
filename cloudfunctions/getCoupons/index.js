// getCoupons - 我的优惠券
const { cloud, ok, auth } = require('../common/index.js');
const { TYPES } = require('../common/coupon.js');

exports.main = auth(async (event) => {
  const { status, available = false, amount = 0 } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  const where = { _openid: event._openid };
  if (status !== undefined) where.status = Number(status);

  const res = await db.collection('couponUsers')
    .where(where)
    .orderBy('expireTime', 'asc')
    .limit(100)
    .get();

  // 关联模板
  const tplIds = [...new Set(res.data.map(c => c.couponId))];
  const tpls = tplIds.length ? await db.collection('coupons').where({ _id: _.in(tplIds) }).get() : { data: [] };
  const tplMap = {};
  tpls.data.forEach(t => tplMap[t._id] = t);

  let list = res.data.map(c => {
    const t = tplMap[c.couponId] || {};
    // 过滤过期
    let realStatus = c.status;
    if (c.status === 0 && c.expireTime && c.expireTime < now) realStatus = 3; // 已过期

    let discount = 0;
    if (t.type === 1) discount = t.amount;
    else if (t.type === 2) discount = (amount || 0) * (1 - t.discount / 10);
    else if (t.type === 3) discount = t.amount;
    else if (t.type === 4) discount = t.amount || 8;

    return {
      ...c,
      ...t,
      status: realStatus,
      typeName: (TYPES[t.type] || {}).name || '优惠券',
      typeIcon: (TYPES[t.type] || {}).icon || '🎫',
      available: realStatus === 0 && (!c.expireTime || c.expireTime > now)
                 && (amount === 0 || (t.minAmount || 0) <= amount),
      discount: Number(discount.toFixed(2))
    };
  });

  if (available) list = list.filter(c => c.available);
  return ok(list);
});
