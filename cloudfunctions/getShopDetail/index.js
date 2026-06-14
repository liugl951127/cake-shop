// getShopDetail - 店铺详情(含所有商品 + 评价聚合)
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { id } = event;
  if (!id) return fail('id 必填');
  const db = cloud.database();

  const shop = await db.collection('shops').doc(id).get();
  if (!shop.data) return fail('店铺不存在', -404);

  // 商品
  const goods = await db.collection('goods')
    .where({ shopId: id, status: 1 })
    .orderBy('sales', 'desc')
    .limit(50)
    .get();

  // 评价
  const reviews = await db.collection('reviews')
    .where({ shopId: id })
    .orderBy('createTime', 'desc')
    .limit(20)
    .get();

  // 评分分布
  const scoreDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of reviews.data) {
    const k = Math.round(r.score);
    if (scoreDist[k] !== undefined) scoreDist[k]++;
    total += r.score || 0;
  }
  const avgScore = reviews.data.length > 0 ? Number((total / reviews.data.length).toFixed(1)) : 5.0;

  return ok({
    shop: shop.data,
    goods: goods.data,
    reviews: reviews.data,
    avgScore,
    reviewCount: reviews.data.length,
    scoreDist
  });
};
