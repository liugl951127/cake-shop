// common/coupon.js - 优惠券核心工具
// 优惠券类型: 1=满减 2=折扣 3=新人券 4=运费券
const TYPES = {
  1: { name: '满减券', icon: '💰' },
  2: { name: '折扣券', icon: '🎫' },
  3: { name: '新人券', icon: '🎁' },
  4: { name: '运费券', icon: '🚚' }
};

async function lockCoupon(db, couponUserId, openid, userId, orderAmount) {
  const cu = await db.collection('couponUsers').doc(couponUserId).get();
  if (!cu.data) throw new Error('优惠券不存在');
  const c = cu.data;
  if (c._openid !== openid) throw new Error('优惠券不属于当前用户');
  if (c.status !== 0) throw new Error('优惠券已使用或过期');
  if (c.expireTime && c.expireTime < Date.now()) throw new Error('优惠券已过期');

  // 重新查模板,获取满减门槛
  const tpl = await db.collection('coupons').doc(c.couponId).get();
  if (!tpl.data) throw new Error('券模板不存在');
  const t = tpl.data;

  if (orderAmount < (t.minAmount || 0)) {
    throw new Error(`订单金额需满 ¥${t.minAmount} 才能使用`);
  }

  // 计算优惠
  let discount = 0;
  if (t.type === 1) discount = t.amount;          // 满减
  else if (t.type === 2) discount = orderAmount * (1 - t.discount / 10); // 折扣
  else if (t.type === 3) discount = t.amount;     // 新人券
  else if (t.type === 4) discount = t.amount || 8; // 运费券
  discount = Math.min(discount, orderAmount);

  // 锁定
  await db.collection('couponUsers').doc(couponUserId).update({
    data: { status: 2, lockTime: Date.now() } // 2-锁定中
  });

  return { discount, type: t.type, name: t.name };
}

async function markCouponUsed(db, couponUserId, userId, orderId) {
  await db.collection('couponUsers').doc(couponUserId).update({
    data: { status: 1, useTime: Date.now(), orderId, updateTime: Date.now() }
  });
}

async function refundCoupon(db, couponUserId, userId) {
  await db.collection('couponUsers').doc(couponUserId).update({
    data: { status: 0, lockTime: 0, updateTime: Date.now() }
  });
}

module.exports = { TYPES, lockCoupon, markCouponUsed, refundCoupon };
