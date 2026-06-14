// getCouponList - 优惠券模板列表(用户端领取中心)
const { cloud, ok } = require('../common/index.js');
const { TYPES } = require('../common/coupon.js');

exports.main = async () => {
  const db = cloud.database();
  const res = await db.collection('coupons')
    .where({ status: 1 })
    .orderBy('createTime', 'desc')
    .limit(30)
    .get();
  return ok(res.data.map(c => ({
    ...c,
    typeName: (TYPES[c.type] || {}).name,
    typeIcon: (TYPES[c.type] || {}).icon,
    soldOut: c.total !== -1 && (c.claimed || 0) >= c.total
  })));
};
