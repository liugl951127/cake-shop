const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const res = await db.collection('favorites')
    .where({ _openid: event._openid, goodsId: id })
    .remove();
  return ok({ removed: res.stats.removed });
});
