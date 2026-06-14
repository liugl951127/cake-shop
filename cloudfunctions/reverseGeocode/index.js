// reverseGeocode - 逆地址解析(经纬度 → 地址)
// 用腾讯地图 HTTP API,需环境变量 TX_MAP_KEY
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { lng, lat } = event;
  if (!lng || !lat) return fail('经纬度必填');

  const KEY = process.env.TX_MAP_KEY;
  if (!KEY) {
    return ok({
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: '', district: '', province: ''
    });
  }

  try {
    const https = require('https');
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${KEY}&get_poi=0`;
    const r = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
      }).on('error', reject);
    });
    if (r.status !== 0) return fail('逆地址失败: ' + (r.message || r.status));
    return ok({
      address: r.result.address,
      city: r.result.address_component.city,
      district: r.result.address_component.district,
      province: r.result.address_component.province
    });
  } catch (e) {
    return ok({
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: '', district: '', province: ''
    });
  }
};
