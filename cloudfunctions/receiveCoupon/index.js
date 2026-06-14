// receiveCoupon - 领取优惠券
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { couponId } = event;
  if (!couponId) throw new BizError('couponId 必填');
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  const tpl = await db.collection('coupons').doc(couponId).get();
  if (!tpl.data) throw new BizError('优惠券不存在');
  const t = tpl.data;

  if (t.status !== 1) throw new BizError('活动已结束');
  if (t.endTime && t.endTime < now) throw new BizError('活动已结束');
  if (t.total !== -1 && (t.claimed || 0) >= t.total) throw new BizError('已领完');

  // 每人限领
  if (t.perUserLimit > 0) {
    const cnt = await db.collection('couponUsers').where({
      _openid: event._openid, couponId
    }).count();
    if (cnt.total >= t.perUserLimit) throw new BizError('已达到单人领取上限');
  }

  // 新人券:仅新用户
  if (t.type === 3) {
    const user = await db.collection('users').doc(event._userId).get();
    if ((user.data.orderCount || 0) > 0) throw new BizError('新人券仅限新用户');
  }

  const expireTime = t.validDays ? now + t.validDays * 86400000 : (t.endTime || now + 30 * 86400000);

  await db.collection('couponUsers').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      couponId,
      status: 0,  // 0-未使用
      receiveTime: now,
      expireTime
    }
  });

  // 累加领取数
  await db.collection('coupons').doc(couponId).update({
    data: { claimed: _.inc(1) }
  }).catch(() => {});

  return ok({ expireTime });
});
