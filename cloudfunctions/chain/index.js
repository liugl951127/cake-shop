// chain - 多门店连锁(总部-分店-员工)
// action: brands / shops / brandConsolidated / brandOverview / shopGroup
const { cloud, ok, fail, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { action = 'brands' } = event;
  switch (action) {
    case 'brands': return listBrands(event);
    case 'shops': return listShops(event);
    case 'brandConsolidated': return brandConsolidated(event);
    case 'brandOverview': return brandOverview(event);
    case 'createBrand': return createBrand(event);
    case 'addShopToBrand': return addShopToBrand(event);
    default: return fail('未知 action');
  }
});

// 品牌列表(连锁集团)
async function listBrands(event) {
  const db = cloud.database();
  const res = await db.collection('brands')
    .where({ status: 1 })
    .orderBy('createTime', 'desc')
    .limit(50)
    .get();
  // 关联门店数
  for (const b of res.data) {
    const c = await db.collection('shops').where({ brandId: b._id, status: 1 }).count();
    b.shopCount = c.total;
  }
  return ok(res.data);
}

// 某品牌的门店
async function listShops(event) {
  const { brandId = '' } = event;
  const db = cloud.database();
  const where = { status: 1 };
  if (brandId) where.brandId = brandId;
  const res = await db.collection('shops').where(where).limit(200).get();
  return ok(res.data);
}

// 营收合并(整个品牌的所有门店一起)
async function brandConsolidated(event) {
  const { brandId, date = '' } = event;
  if (!brandId) return fail('brandId 必填');
  const db = cloud.database();
  const _ = db.command;
  const d = date || new Date().toISOString().slice(0, 10);
  const dStart = new Date(d).getTime();
  const dEnd = dStart + 86400000;

  // 找该品牌下所有门店
  const shops = await db.collection('shops').where({ brandId, status: 1 }).get();
  const shopIds = shops.data.map(s => s._id);
  if (!shopIds.length) return ok({ brandId, date: d, total: {}, shops: [] });

  const orders = await db.collection('orders')
    .where({ shopId: _.in(shopIds), payTime: _.gte(dStart).and(_.lt(dEnd)), status: _.gte(1) })
    .get();

  // 按门店聚合
  const byShop = {};
  for (const s of shops.data) byShop[s._id] = { shopId: s._id, name: s.name, revenue: 0, count: 0, refund: 0 };
  for (const o of orders.data) {
    if (!byShop[o.shopId]) continue;
    byShop[o.shopId].revenue += o.totalPrice || 0;
    byShop[o.shopId].count++;
  }
  const total = {
    revenue: Number(orders.data.reduce((s, o) => s + (o.totalPrice || 0), 0).toFixed(2)),
    count: orders.data.length,
    shops: shopIds.length
  };
  return ok({ brandId, date: d, total, shops: Object.values(byShop) });
}

// 品牌总览(最近 30 天)
async function brandOverview(event) {
  const { brandId } = event;
  if (!brandId) return fail('brandId 必填');
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const start = now - 30 * 86400000;

  const shops = await db.collection('shops').where({ brandId, status: 1 }).get();
  const shopIds = shops.data.map(s => s._id);
  if (!shopIds.length) return ok({ total: {}, shopCount: 0, trend: [], topShops: [] });

  const orders = await db.collection('orders')
    .where({ shopId: _.in(shopIds), payTime: _.gte(start), status: _.gte(1) })
    .get();
  const total = {
    revenue: Number(orders.data.reduce((s, o) => s + (o.totalPrice || 0), 0).toFixed(2)),
    count: orders.data.length,
    avgOrder: 0
  };
  total.avgOrder = total.count > 0 ? Number((total.revenue / total.count).toFixed(2)) : 0;

  // 按天趋势
  const trend = [];
  for (let i = 29; i >= 0; i--) {
    const dStart = new Date(new Date().toDateString()).getTime() - i * 86400000;
    const dEnd = dStart + 86400000;
    const dayOrders = orders.data.filter(o => o.payTime >= dStart && o.payTime < dEnd);
    trend.push({
      date: new Date(dStart).toISOString().slice(5, 10),
      revenue: Number(dayOrders.reduce((s, o) => s + (o.totalPrice || 0), 0).toFixed(2)),
      count: dayOrders.length
    });
  }
  // TOP 门店
  const byShop = {};
  for (const s of shops.data) byShop[s._id] = { shopId: s._id, name: s.name, revenue: 0, count: 0 };
  for (const o of orders.data) {
    if (!byShop[o.shopId]) continue;
    byShop[o.shopId].revenue += o.totalPrice || 0;
    byShop[o.shopId].count++;
  }
  const topShops = Object.values(byShop).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return ok({ total, shopCount: shopIds.length, trend, topShops });
}

async function createBrand(event) {
  const { name, logo = '', description = '' } = event;
  if (!name) return fail('品牌名必填');
  const db = cloud.database();
  const now = Date.now();
  const res = await db.collection('brands').add({
    data: { name, logo, description, status: 1, createTime: now }
  });
  return ok({ id: res._id });
}

async function addShopToBrand(event) {
  const { brandId, shopId } = event;
  if (!brandId || !shopId) return fail('参数必填');
  const db = cloud.database();
  await db.collection('shops').doc(shopId).update({ data: { brandId, updateTime: Date.now() } });
  return ok({ ok: true });
}
