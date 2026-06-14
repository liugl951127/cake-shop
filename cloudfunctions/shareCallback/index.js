// shareCallback - 分享得券回调
// 客户端 wx.showShareMenu 分享后,从 shareTicket 解析,调用此函数
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { shareTicket, fromOpenid, shareType = 'goods' } = event;
  if (!shareTicket) throw new BizError('分享凭证缺失');

  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const today = new Date(now).setHours(0, 0, 0, 0);

  // 每天最多奖励 3 次
  const todayCount = await db.collection('shareRewards').where({
    _openid: event._openid,
    createTime: _.gte(today)
  }).count();
  if (todayCount.total >= 3) throw new BizError('今日分享奖励已达上限');

  // 发券:找一张可分享的优惠券模板
  const coupon = await db.collection('coupons').where({
    status: 1, type: 1, total: -1
  }).limit(1).get();
  if (!coupon.data[0]) {
    // 没有可分享券,发积分代替
    const user = await db.collection('users').doc(event._userId).get();
    const newPoints = (user.data.points || 0) + 10;
    await db.collection('users').doc(event._userId).update({ data: { points: newPoints } });
    await db.collection('pointLogs').add({
      data: {
        _openid: event._openid, type: 'share', delta: 10, balance: newPoints,
        remark: '分享好友奖励积分', createTime: now
      }
    });
    await db.collection('shareRewards').add({ data: { _openid: event._openid, type: 'points', createTime: now } });
    return ok({ reward: 'points', points: 10 });
  }

  const tpl = coupon.data[0];
  const expireTime = tpl.validDays ? now + tpl.validDays * 86400000 : now + 30 * 86400000;
  await db.collection('couponUsers').add({
    data: {
      _openid: event._openid, _userId: event._userId,
      couponId: tpl._id, status: 0,
      receiveTime: now, expireTime, fromShare: true
    }
  });
  await db.collection('coupons').doc(tpl._id).update({ data: { claimed: _.inc(1) } }).catch(() => {});
  await db.collection('shareRewards').add({
    data: { _openid: event._openid, type: 'coupon', couponId: tpl._id, createTime: now }
  });

  return ok({ reward: 'coupon', couponName: tpl.name, couponId: tpl._id });
});
