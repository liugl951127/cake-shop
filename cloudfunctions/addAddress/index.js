const { cloud, ok, auth, BizError, ErrorCode, logger } = require('../common/index.js');

exports.main = auth(async (event) => {
  const {
    name, phone, region, detail,
    provinceId, cityId, districtId,   // 新增:省市区id(更精准)
    provinceName, cityName, districtName,
    isDefault, lng, lat
  } = event;

  if (!name) throw new BizError('请填写姓名', ErrorCode.BAD_REQUEST);
  if (!/^1\d{10}$/.test(phone)) throw new BizError('手机号格式错误', ErrorCode.BAD_REQUEST);
  if (!region && !(provinceName && cityName && districtName)) throw new BizError('请选择地区', ErrorCode.BAD_REQUEST);
  if (!detail || detail.length < 5) throw new BizError('详细地址至少 5 个字', ErrorCode.BAD_REQUEST);

  const finalRegion = region || `${provinceName} ${cityName} ${districtName}`;

  const db = cloud.database();
  const _ = db.command;

  // 默认地址唯一性
  if (isDefault) {
    await db.collection('addresses').where({
      _openid: event._openid, isDefault: true
    }).update({ data: { isDefault: false } }).catch(() => {});
  }

  // 单用户最多 20 个地址
  const cnt = await db.collection('addresses').where({ _openid: event._openid }).count();
  if (cnt.total >= 20) throw new BizError('收货地址最多 20 个,请先删除不常用的', ErrorCode.RATE_LIMIT);

  const res = await db.collection('addresses').add({
    data: {
      _openid: event._openid,
      name, phone,
      region: finalRegion,
      provinceId: provinceId || 0,
      cityId: cityId || 0,
      districtId: districtId || 0,
      provinceName: provinceName || '',
      cityName: cityName || '',
      districtName: districtName || '',
      detail,
      isDefault: !!isDefault,
      lng: lng || 0,
      lat: lat || 0,
      createTime: Date.now()
    }
  });
  return ok({ _id: res._id });
});
