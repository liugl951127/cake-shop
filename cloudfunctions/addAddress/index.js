const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { name, phone, region, detail, isDefault } = event;
  if (!name || !phone || !region || !detail) throw new BizError('字段不完整');
  if (!/^1\d{10}$/.test(phone)) throw new BizError('手机号格式错误');

  const db = cloud.database();
  const _ = db.command;

  if (isDefault) {
    // 取消其他默认
    await db.collection('addresses').where({
      _openid: event._openid, isDefault: true
    }).update({ data: { isDefault: false } }).catch(() => {});
  }

  const res = await db.collection('addresses').add({
    data: {
      _openid: event._openid,
      name, phone, region, detail,
      isDefault: !!isDefault,
      createTime: Date.now()
    }
  });
  return ok({ _id: res._id });
});
