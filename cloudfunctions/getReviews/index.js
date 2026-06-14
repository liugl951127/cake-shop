// getReviews - 评价列表(支持筛选:全部/好评/中评/差评/有图)
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { goodsId = '', shopId = '', filter = 'all', page = 1, pageSize = 10 } = event;
  if (!goodsId && !shopId) return fail('goodsId 或 shopId 必填');
  const db = cloud.database();
  const _ = db.command;

  const where = { status: 1, parentId: '' };  // 顶级评价
  if (goodsId) where.goodsId = goodsId;
  if (shopId) where.shopId = shopId;
  if (filter === 'good') where.score = _.gte(4);
  else if (filter === 'mid') where.score = _.eq(3);
  else if (filter === 'bad') where.score = _.lte(2);
  else if (filter === 'image') where.images = _.neq([]);

  const res = await db.collection('reviews')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  // 关联商品
  const goodsIds = [...new Set(res.data.map(r => r.goodsId))];
  let goodsMap = {};
  if (goodsIds.length) {
    const goodsRes = await db.collection('goods')
      .where({ _id: _.in(goodsIds) })
      .field({ name: true, image: true })
      .get();
    goodsMap = Object.fromEntries(goodsRes.data.map(g => [g._id, g]));
  }

  // 加载追评 / 回复
  for (const r of res.data) {
    r.goods = goodsMap[r.goodsId] || null;
    const subs = await db.collection('reviews')
      .where({ parentId: r._id, status: 1 })
      .orderBy('createTime', 'asc')
      .limit(5)
      .get();
    r.replies = subs.data;
  }

  return ok({ list: res.data, hasMore: res.data.length === pageSize });
};
