// getFavorites - 收藏列表(支持分组)
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { groupId } = event;
  const db = cloud.database();
  const where = { _openid: event._openid };
  if (groupId) where.groupId = groupId;
  if (groupId === 'default') where.groupId = _.not(_.neq('default'));

  const favs = await db.collection('favorites')
    .where(where)
    .orderBy('createTime', 'desc')
    .get();

  if (favs.data.length === 0) return ok([]);

  const ids = favs.data.map(f => f.goodsId);
  const _ = db.command;
  const goodsRes = await db.collection('goods').where({ _id: _.in(ids) }).get();
  const goodsMap = {};
  goodsRes.data.forEach(g => goodsMap[g._id] = g);

  return ok(favs.data.map(f => goodsMap[f.goodsId]).filter(Boolean));
});
