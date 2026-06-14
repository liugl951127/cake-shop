// getStores - 门店列表(按距离排序)
const { cloud, ok } = require('../common/index.js');

function calcDistance(lat1, lng1, lat2, lng2) {
  // Haversine 公式
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

exports.main = async (event) => {
  const { lng = 0, lat = 0, city = '' } = event;
  const db = cloud.database();
  const res = await db.collection('stores')
    .where({ status: 1 })
    .limit(50)
    .get();
  let list = res.data;
  if (lng && lat) {
    list = list.map(s => ({
      ...s,
      distance: s.lng && s.lat ? Number(calcDistance(lat, lng, s.lat, s.lng).toFixed(2)) : null
    })).sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }
  if (city) list = list.filter(s => s.city === city || s.city === '');
  return ok(list);
};
