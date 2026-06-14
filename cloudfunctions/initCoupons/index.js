// initCoupons - 初始化演示优惠券
const { cloud, ok } = require('../common/index.js');

const COUPONS = [
  { name: '新人 50 元大礼包', type: 3, amount: 50, minAmount: 99, total: -1, perUserLimit: 1, validDays: 30 },
  { name: '满 100 减 10', type: 1, amount: 10, minAmount: 100, total: 1000, perUserLimit: 1, validDays: 30 },
  { name: '满 200 减 30', type: 1, amount: 30, minAmount: 200, total: 500, perUserLimit: 1, validDays: 30 },
  { name: '全场 9 折', type: 2, discount: 9, minAmount: 0, total: -1, perUserLimit: 1, validDays: 15 },
  { name: '免运费券', type: 4, amount: 8, minAmount: 0, total: -1, perUserLimit: 2, validDays: 30 }
];

exports.main = async () => {
  const db = cloud.database();
  const exist = await db.collection('coupons').limit(1).get();
  if (exist.data.length > 0) return ok({ inserted: 0, message: '已存在数据,跳过' });

  let count = 0;
  for (const c of COUPONS) {
    await db.collection('coupons').add({
      data: { ...c, claimed: 0, status: 1, createTime: Date.now() }
    });
    count++;
  }
  return ok({ inserted: count });
};
