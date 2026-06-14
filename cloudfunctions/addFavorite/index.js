const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const _ = db.command;

  // 查重
  const exist = await db.collection('favorites')
    .where({ _openid: event._openid, goodsId: id })
    .limit(1)
    .get();
  if (exist.data.length > 0) return ok();

  await db.collection('favorites').add({
    data: {
      _openid: event._openid,
      goodsId: id,
      createTime: Date.now()
    }
  });
  return ok();
});
