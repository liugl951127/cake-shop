// luckyBag - 拼手气福袋
// 玩法: 用户支付固定金额(1 元),随机抽一个奖品
// 防作弊: 同一用户每天最多 3 次,中奖次数限制
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { luckyDraw, buildPrizePool } = require('../common/promo.js');

exports.main = auth(async (event) => {
  const { activityId = 'default', bagId = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const today = new Date(now).setHours(0, 0, 0, 0);

  // 找活动
  const act = await db.collection('luckyBag').where({
    _id: activityId, status: 1
  }).limit(1).get();
  if (!act.data[0]) throw new BizError('活动不存在');
  const a = act.data[0];
  if (now < a.startTime || now > a.endTime) throw new BizError('活动未开始或已结束');
  if (a.stock <= 0) throw new BizError('福袋已抢光');

  // 每日上限
  if (a.perUserDailyLimit) {
    const cnt = await db.collection('luckyBagLogs').where({
      _openid: event._openid, activityId,
      createTime: _.gte(today)
    }).count();
    if (cnt.total >= a.perUserDailyLimit) {
      throw new BizError(`每日最多 ${a.perUserDailyLimit} 次`);
    }
  }

  // 中奖次数限制
  if (a.perUserMaxWin) {
    const wins = await db.collection('luckyBagLogs').where({
      _openid: event._openid, activityId, isWin: true
    }).count();
    if (wins.total >= a.perUserMaxWin) {
      throw new BizError(`最多中奖 ${a.perUserMaxWin} 次`);
    }
  }

  // 扣库存
  await db.collection('luckyBag').doc(a._id).update({
    data: { stock: _.inc(-1), used: _.inc(1) }
  });

  // 抽
  const pool = buildPrizePool(a.prizes || []);
  const prize = luckyDraw(pool);
  const isWin = prize && prize.value > 0;

  const logRes = await db.collection('luckyBagLogs').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      activityId,
      bagId,
      prizeName: prize ? prize.name : '谢谢参与',
      prizeValue: prize ? prize.value : 0,
      isWin,
      createTime: now
    }
  });

  // 中奖派发: 优惠券/积分/商品
  if (isWin) {
    if (prize.type === 'coupon' && prize.couponId) {
      await db.collection('couponUsers').add({
        data: {
          _openid: event._openid, _userId: event._userId,
          couponId: prize.couponId, status: 0,
          receiveTime: now, expireTime: now + 30 * 86400000,
          fromLuckyBag: true
        }
      });
    } else if (prize.type === 'points') {
      const user = await db.collection('users').doc(event._userId).get();
      const newPoints = (user.data.points || 0) + prize.value;
      await db.collection('users').doc(event._userId).update({
        data: { points: newPoints }
      });
      await db.collection('pointLogs').add({
        data: {
          _openid: event._openid, type: 'lucky_bag',
          delta: prize.value, balance: newPoints,
          remark: `拼手气奖励:${prize.name}`,
          createTime: now
        }
      });
    } else if (prize.type === 'goods' && prize.goodsId) {
      // 实物商品,生成兑换码,商家发奖
      const code = `LB${now}${Math.floor(Math.random() * 1000)}`;
      await db.collection('luckyBagWins').add({
        data: {
          _openid: event._openid,
          _userId: event._userId,
          activityId,
          goodsId: prize.goodsId,
          code,
          status: 0,  // 0-待核销 1-已核销
          createTime: now
        }
      });
    }
  }

  return ok({
    prize: prize ? { name: prize.name, value: prize.value, type: prize.type, image: prize.image } : null,
    isWin,
    bagId: logRes._id,
    stockRemain: a.stock - 1
  });
});
