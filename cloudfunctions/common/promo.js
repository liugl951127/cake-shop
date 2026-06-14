// common/promo.js - 营销活动核心
// 满减 / 折扣 / 拼手气 三种活动

// 计算最优优惠(满减/折扣可叠加)
function calcBestDiscount(amount, promos) {
  // promos: [{ type:'full_reduce', fullAmount, reduceAmount }, { type:'discount', discountRate }, ...]
  // 选最优(降序)
  const opts = [];
  for (const p of promos) {
    if (!p || p.status !== 1) continue;
    const now = Date.now();
    if (p.startTime && now < p.startTime) continue;
    if (p.endTime && now > p.endTime) continue;
    if (amount < (p.minAmount || 0)) continue;

    let discount = 0;
    if (p.type === 'full_reduce') {
      // 满 X 减 Y(可叠加多档)
      discount = Math.floor(amount / p.fullAmount) * p.reduceAmount;
      if (p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
    } else if (p.type === 'discount') {
      // 折扣: 8.5 折
      discount = amount * (1 - p.discountRate);
    }
    if (discount > 0) {
      opts.push({ promo: p, discount: Number(discount.toFixed(2)) });
    }
  }
  opts.sort((a, b) => b.discount - a.discount);
  return opts[0] || null;
}

// 拼手气算法 - 公平随机分配
// 奖品池 + 权重, 总和 = 中奖率
// 抽中后从池里随机抽一个
function luckyDraw(pool, seed = Date.now()) {
  if (!pool || pool.length === 0) return null;
  // 简单随机(可换 crypto)
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

// 拼手气奖品池生成
function buildPrizePool(config) {
  // config: [{ name, value, weight }]
  const pool = [];
  for (const p of config) {
    for (let i = 0; i < p.weight; i++) pool.push(p);
  }
  return pool;
}

module.exports = { calcBestDiscount, luckyDraw, buildPrizePool };
