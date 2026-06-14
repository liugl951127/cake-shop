const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  // 取消其他默认
  await db.collection('addresses').where({
    _openid: event._openid, isDefault: true
  }).update({ data: { isDefault: false } });
  // 设置新的
  await db.collection('addresses').doc(id).update({ data: { isDefault: true } });
  return ok();
});
