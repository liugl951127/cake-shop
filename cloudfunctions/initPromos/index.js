// initPromos - 初始化营销活动 + 拼手气福袋
const { cloud, ok } = require('../common/index.js');

const PROMOS = [
  { name: '满 100 减 10', type: 'full_reduce', minAmount: 100, fullAmount: 100, reduceAmount: 10, status: 1 },
  { name: '满 200 减 30', type: 'full_reduce', minAmount: 200, fullAmount: 200, reduceAmount: 30, status: 1 },
  { name: '满 300 减 50', type: 'full_reduce', minAmount: 300, fullAmount: 300, reduceAmount: 50, status: 1 },
  { name: '满 500 减 100', type: 'full_reduce', minAmount: 500, fullAmount: 500, reduceAmount: 100, maxDiscount: 100, status: 1 },
  { name: '全场 9 折', type: 'discount', minAmount: 0, discountRate: 0.9, status: 1 }
];

const LUCKY_BAG = {
  _id: 'default',
  name: '🎁 每日福袋',
  desc: '1 元抽大奖,100% 中奖',
  price: 1,
  stock: 200,
  used: 0,
  perUserDailyLimit: 3,
  perUserMaxWin: 2,
  prizes: [
    { name: '蛋糕兑换券 ¥50', value: 50, type: 'coupon', weight: 5, image: '🎂' },
    { name: '蛋糕兑换券 ¥20', value: 20, type: 'coupon', weight: 10, image: '🍰' },
    { name: '满 100 减 10 券', value: 10, type: 'coupon', weight: 20, image: '🎟️' },
    { name: '100 积分', value: 100, type: 'points', weight: 30, image: '💎' },
    { name: '50 积分', value: 50, type: 'points', weight: 30, image: '⭐' },
    { name: '谢谢参与', value: 0, type: 'thanks', weight: 5, image: '😢' }
  ],
  startTime: Date.now(),
  endTime: Date.now() + 30 * 86400000,
  status: 1
};

exports.main = async () => {
  const db = cloud.database();
  let promos = 0, bags = 0;

  for (const p of PROMOS) {
    const exist = await db.collection('promos').where({ name: p.name }).limit(1).get();
    if (exist.data.length === 0) {
      await db.collection('promos').add({ data: { ...p, createTime: Date.now() } });
      promos++;
    }
  }

  const bagExist = await db.collection('luckyBag').doc('default').get().catch(() => null);
  if (!bagExist || !bagExist.data) {
    await db.collection('luckyBag').add({ data: LUCKY_BAG });
    bags++;
  }

  return ok({ inserted: { promos, bags } });
};
