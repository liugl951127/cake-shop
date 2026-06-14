// getShops - 店铺列表(支持多种筛选 + 分销代理)
const { cloud, ok } = require('../common/index.js');

exports.main = async (event) => {
  const { lng = 0, lat = 0, city = '', category = '', featured = false, limit = 50 } = event;
  const db = cloud.database();
  const where = { status: 1 };
  if (city) where.city = city;
  if (featured) where.featured = true;
  if (category) where.category = category;

  const res = await db.collection('shops')
    .where(where)
    .limit(limit)
    .get();

  // 距离 + 商品统计
  const list = await Promise.all(res.data.map(async (s) => {
    let distance = null;
    if (lng && lat && s.lng && s.lat) {
      distance = calcDistance(lat, lng, s.lat, s.lng);
    }
    // 店铺商品数
    const goods = await db.collection('goods').where({ shopId: s._id, status: 1 }).count();
    // 店铺评分
    const reviews = await db.collection('reviews').where({ shopId: s._id }).limit(100).get();
    const avgScore = reviews.data.length > 0
      ? Number((reviews.data.reduce((sum, r) => sum + (r.score || 0), 0) / reviews.data.length).toFixed(1))
      : 5.0;
    return {
      ...s,
      distance: distance ? Number(distance.toFixed(2)) : null,
      goodsCount: goods.total,
      reviewCount: reviews.data.length,
      score: avgScore
    };
  }));

  // 按距离排序
  list.sort((a, b) => (a.distance || 999) - (b.distance || 999));
  return ok(list);
};

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
