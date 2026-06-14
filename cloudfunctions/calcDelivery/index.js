// calcDelivery - 同城配送费计算
// 规则:
//  - 起步价 5 元(3 公里内)
//  - 每公里 +1.5 元
//  - 夜间(22:00 - 8:00) +5 元
//  - 重量 > 5kg 每 kg +0.5
//  - 满 200 包邮
const { cloud, ok, fail } = require('../common/index.js');

const BASE_FEE = 5;
const BASE_DISTANCE = 3;
const PER_KM = 1.5;
const NIGHT_EXTRA = 5;
const HEAVY_PER_KG = 0.5;
const FREE_LIMIT = 200;

exports.main = async (event) => {
  const { fromLng, fromLat, toLng, toLat, weight = 1, orderAmount = 0, type = 'intra' } = event;
  if (toLng === undefined || toLat === undefined) return fail('需要目标经纬度');

  // 距离
  const distance = haversine(fromLat, fromLng, toLat, toLng);

  // 跨城(>50km)走快递
  if (type === 'auto') type = distance > 50 ? 'express' : 'intra';

  let fee = 0;
  let rule = '';
  if (type === 'intra') {
    fee = BASE_FEE;
    if (distance > BASE_DISTANCE) {
      fee += (distance - BASE_DISTANCE) * PER_KM;
    }
    // 夜间
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 8) {
      fee += NIGHT_EXTRA;
      rule = `夜间配送 +${NIGHT_EXTRA}`;
    }
    // 重物
    if (weight > 5) {
      fee += (weight - 5) * HEAVY_PER_KG;
      rule += rule ? `,重物 +${((weight - 5) * HEAVY_PER_KG).toFixed(1)}` : `重物 +${((weight - 5) * HEAVY_PER_KG).toFixed(1)}`;
    }
    // 包邮
    if (orderAmount >= FREE_LIMIT) {
      rule += (rule ? ',' : '') + `满${FREE_LIMIT}包邮`;
      fee = 0;
    }
  } else {
    // 快递: 12 元起步,每公斤 +2,跨省 +10
    fee = 12;
    if (distance > 50) fee += 10;
    fee += weight * 2;
  }

  return ok({
    type,
    distance: Number(distance.toFixed(2)),
    fee: Number(fee.toFixed(2)),
    rule,
    eta: type === 'intra' ? Math.ceil(distance / 25 * 60) + '分钟' : '1-3天'
  });
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
