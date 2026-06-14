const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { id, name, phone, region, detail, isDefault } = event;
  if (!id) throw new BizError('id 必填');
  if (phone && !/^1\d{10}$/.test(phone)) throw new BizError('手机号格式错误');

  const db = cloud.database();
  if (isDefault) {
    await db.collection('addresses').where({
      _openid: event._openid, isDefault: true
    }).update({ data: { isDefault: false } }).catch(() => {});
  }

  const data = {};
  ['name', 'phone', 'region', 'detail', 'isDefault'].forEach(k => {
    if (event[k] !== undefined) data[k] = event[k];
  });
  await db.collection('addresses').doc(id).update({ data });
  return ok();
});
