// common/coupon.js - 优惠券核心工具
// 状态机: 0-未使用 1-已使用 2-锁定中
// 类型: 1=满减 2=折扣 3=新人券 4=运费券 5=流失挽回券 6=VIP 专属
const { BizError, ErrorCode } = require('./index.js');

const TYPES = {
  1: { name: '满减券', icon: '💰' },
  2: { name: '折扣券', icon: '🎫' },
  3: { name: '新人券', icon: '🎁' },
  4: { name: '运费券', icon: '🚚' },
  5: { name: '回归券', icon: '💌' },
  6: { name: 'VIP 券', icon: '👑' }
};

const STATUS = {
  UNUSED: 0,
  USED: 1,
  LOCKED: 2
};

/**
 * 锁定优惠券
 * @returns { discount, type, name, couponUserId }
 * @throws BizError(EXPIRED/USED/AMOUNT_INVALID)
 */
async function lockCoupon(db, couponUserId, openid, orderAmount) {
  const cu = await db.collection('couponUsers').doc(couponUserId).get();
  if (!cu.data) throw new BizError('优惠券不存在', ErrorCode.NOT_FOUND);
  const c = cu.data;
  if (c._openid !== openid) {
    throw new BizError('优惠券不属于当前用户', ErrorCode.FORBIDDEN);
  }
  if (c.status === STATUS.USED) {
    throw new BizError('优惠券已使用', ErrorCode.COUPON_USED);
  }
  if (c.expireTime && c.expireTime < Date.now()) {
    throw new BizError('优惠券已过期', ErrorCode.COUPON_EXPIRED);
  }
  if (c.status !== STATUS.UNUSED) {
    throw new BizError('优惠券状态不可用', ErrorCode.COUPON_USED);
  }

  // 重新查模板
  const tpl = await db.collection('coupons').doc(c.couponId).get();
  if (!tpl.data) throw new BizError('券模板不存在', ErrorCode.NOT_FOUND);
  const t = tpl.data;

  // 满减门槛校验
  if (orderAmount < (t.minAmount || 0)) {
    throw new BizError(
      `订单金额需满 ¥${t.minAmount} 才能使用`,
      ErrorCode.COUPON_NOT_MATCH
    );
  }

  // 计算优惠
  let discount = 0;
  if (t.type === 1) discount = t.amount;
  else if (t.type === 2) discount = orderAmount * (1 - t.discount / 10);
  else if (t.type === 3) discount = t.amount;
  else if (t.type === 4) discount = t.amount || 8;
  else if (t.type === 5 || t.type === 6) discount = t.amount || 0;
  discount = Math.min(discount, orderAmount);
  discount = Math.max(0, Number(discount.toFixed(2)));

  // 原子锁: 条件 status=0,否则冲突
  const res = await db.collection('couponUsers').doc(couponUserId).update({
    data: { status: STATUS.LOCKED, lockTime: Date.now() }
  });
  if (res.updated === 0) {
    throw new BizError('优惠券已被锁定,请重试', ErrorCode.CONFLICT);
  }

  return { discount, type: t.type, name: t.name, couponUserId };
}

/**
 * 标记已使用(支付成功回调时)
 */
async function markCouponUsed(db, couponUserId, orderId) {
  await db.collection('couponUsers').doc(couponUserId).update({
    data: {
      status: STATUS.USED,
      useTime: Date.now(),
      orderId,
      updateTime: Date.now()
    }
  });
}

/**
 * 释放(下单失败/取消时)
 */
async function refundCoupon(db, couponUserId) {
  await db.collection('couponUsers').doc(couponUserId).update({
    data: { status: STATUS.UNUSED, lockTime: 0, updateTime: Date.now() }
  });
}

module.exports = { TYPES, STATUS, lockCoupon, markCouponUsed, refundCoupon };
