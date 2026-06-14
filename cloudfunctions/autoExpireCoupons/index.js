// autoExpireCoupons - 每天凌晨清理过期优惠券
// Cron: 0 0 2 * * * *
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const res = await db.collection('couponUsers').where({
    status: 0,
    expireTime: _.lt(now)
  }).update({
    data: { status: 3, updateTime: now }
  });
  return ok({ expired: res.stats.updated });
};
