const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const favs = await db.collection('favorites')
    .where({ _openid: event._openid })
    .orderBy('createTime', 'desc')
    .get();

  if (favs.data.length === 0) return ok([]);

  // 关联查询商品信息
  const ids = favs.data.map(f => f.goodsId);
  const _ = db.command;
  const goodsRes = await db.collection('goods').where({ _id: _.in(ids) }).get();

  return ok(goodsRes.data);
});
