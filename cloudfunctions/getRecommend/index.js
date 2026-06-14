// getRecommend - 个性化推荐
// 1. 看了又看:同样浏览过该商品的用户还浏览了哪些
// 2. 个性化:基于用户最近浏览的分类推荐
// 3. 全局热门:sales 排序
const { cloud, ok } = require('../common/index.js');

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

exports.main = async (event) => {
  const { openid = '', goodsId = '', pageSize = 10 } = event;
  const cacheKey = `${openid}:${goodsId}`;
  const cached = CACHE.get(cacheKey);
  if (cached && cached.exp > Date.now()) return ok(cached.data);

  let result = [];

  if (goodsId) {
    result = await alsoViewed(goodsId, pageSize);
    if (result.length < pageSize) {
      const exclude = [goodsId, ...result.map(r => r._id)];
      const fill = await hotGoods(pageSize - result.length, exclude);
      result = [...result, ...fill];
    }
  } else if (openid) {
    result = await personalized(openid, pageSize);
    if (result.length < pageSize) {
      const fill = await hotGoods(pageSize - result.length, result.map(r => r._id));
      result = [...result, ...fill];
    }
  } else {
    result = await hotGoods(pageSize, []);
  }

  CACHE.set(cacheKey, { data: result, exp: Date.now() + CACHE_TTL });
  return ok(result);
};

async function alsoViewed(goodsId, limit) {
  const db = cloud.database();
  const _ = db.command;
  const viewers = await db.collection('behaviors')
    .where({ action: 'view', goodsId })
    .limit(500)
    .get();
  if (viewers.data.length === 0) return [];

  const viewerIds = [...new Set(viewers.data.map(v => v._openid))];
  const since = Date.now() - 30 * 86400000;
  const otherViews = await db.collection('behaviors')
    .where({
      action: 'view',
      _openid: _.in(viewerIds),
      goodsId: _.neq(goodsId),
      createTime: _.gt(since)
    })
    .limit(1000)
    .get();

  const cnt = {};
  for (const v of otherViews.data) {
    cnt[v.goodsId] = (cnt[v.goodsId] || 0) + 1;
  }
  const sorted = Object.entries(cnt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (sorted.length === 0) return [];
  const goods = await db.collection('goods')
    .where({ _id: _.in(sorted), status: 1 })
    .get();
  return sorted.map(id => goods.data.find(g => g._id === id)).filter(Boolean);
}

async function personalized(openid, limit) {
  const db = cloud.database();
  const _ = db.command;
  const recent = await db.collection('behaviors')
    .where({ _openid: openid, action: 'view' })
    .orderBy('createTime', 'desc')
    .limit(30)
    .get();
  if (recent.data.length === 0) return hotGoods(limit, []);

  const ids = [...new Set(recent.data.map(r => r.goodsId))];
  const goods = await db.collection('goods')
    .where({ _id: _.in(ids) })
    .get();
  const categories = [...new Set(goods.data.map(g => g.category).filter(Boolean))];
  if (categories.length === 0) return hotGoods(limit, ids);

  const recs = await db.collection('goods')
    .where({
      category: _.in(categories),
      status: 1,
      _id: _.nin(ids)
    })
    .orderBy('sales', 'desc')
    .limit(limit)
    .get();
  return recs.data;
}

async function hotGoods(limit, exclude = []) {
  const db = cloud.database();
  const _ = db.command;
  const where = { status: 1 };
  if (exclude.length) where._id = _.nin(exclude);
  const res = await db.collection('goods')
    .where(where)
    .orderBy('sales', 'desc')
    .limit(limit)
    .get();
  return res.data;
}
