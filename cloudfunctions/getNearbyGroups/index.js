// getNearbyGroups - 附近拼团(基于位置排序)
// 简化: 用 Haversine 公式在内存算距离
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { lng = 0, lat = 0, city = '', limit = 20, maxDistance = 10 } = event;
  if (!lng || !lat) return fail('需要经纬度');

  const db = cloud.database();
  const _ = db.command;

  // 找进行中的拼团
  const where = { status: 1, expireTime: _.gt(Date.now()) };
  if (city) where.city = city;

  const res = await db.collection('groupBuys')
    .where(where)
    .orderBy('createTime', 'desc')
    .limit(200)
    .get();

  // 距离计算 + 过滤
  const groups = res.data
    .map(g => {
      let distance = null;
      if (g.lng && g.lat) distance = haversine(lat, lng, g.lat, g.lng);
      return { ...g, distance };
    })
    .filter(g => !g.distance || g.distance <= maxDistance)
    .sort((a, b) => (a.distance || 999) - (b.distance || 999))
    .slice(0, limit);

  // 关联商品
  const goodsIds = [...new Set(groups.map(g => g.goodsId))];
  if (goodsIds.length) {
    const goods = await db.collection('goods')
      .where({ _id: _.in(goodsIds) })
      .field({ name: true, image: true, price: true })
      .get();
    const map = Object.fromEntries(goods.data.map(g => [g._id, g]));
    for (const g of groups) g.goods = map[g.goodsId] || null;
  }

  return ok(groups);
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
