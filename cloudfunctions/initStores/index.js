// initStores - 演示门店
const { cloud, ok } = require('../common/index.js');

const STORES = [
  { _id: 's_bj_01', name: '甜心蛋糕(北京三里屯店)', city: '北京', region: '北京市 朝阳区', address: '三里屯太古里 N3-12', lng: 116.454859, lat: 39.937235, phone: '010-88886666', hours: '09:00-22:00', status: 1 },
  { _id: 's_bj_02', name: '甜心蛋糕(北京国贸店)', city: '北京', region: '北京市 朝阳区', address: '国贸 CBD 万达广场 B1', lng: 116.460201, lat: 39.913094, phone: '010-88885555', hours: '09:00-22:00', status: 1 },
  { _id: 's_sh_01', name: '甜心蛋糕(上海南京路店)', city: '上海', region: '上海市 黄浦区', address: '南京东路 100 号', lng: 121.485428, lat: 31.236305, phone: '021-66668888', hours: '09:00-22:00', status: 1 },
  { _id: 's_sh_02', name: '甜心蛋糕(上海徐汇店)', city: '上海', region: '上海市 徐汇区', address: '徐家汇美罗城 2F', lng: 121.437525, lat: 31.198495, phone: '021-66667777', hours: '09:00-22:00', status: 1 },
  { _id: 's_gz_01', name: '甜心蛋糕(广州天河店)', city: '广州', region: '广东省 广州市 天河区', address: '天河城购物中心 4F', lng: 113.325832, lat: 23.135604, phone: '020-88889999', hours: '09:00-22:00', status: 1 },
  { _id: 's_sz_01', name: '甜心蛋糕(深圳南山店)', city: '深圳', region: '广东省 深圳市 南山区', address: '万象天地 L2', lng: 113.935737, lat: 22.538636, phone: '0755-88886666', hours: '09:00-22:00', status: 1 },
  { _id: 's_hz_01', name: '甜心蛋糕(杭州西湖店)', city: '杭州', region: '浙江省 杭州市 西湖区', address: '湖滨银泰 in77 B 区', lng: 120.155491, lat: 30.252830, phone: '0571-88886666', hours: '09:00-22:00', status: 1 }
];

exports.main = async () => {
  const db = cloud.database();
  let count = 0;
  for (const s of STORES) {
    try {
      const exist = await db.collection('stores').doc(s._id).get().catch(() => null);
      if (!exist) {
        await db.collection('stores').add({ data: { ...s, createTime: Date.now() } });
        count++;
      }
    } catch (e) {}
  }
  return ok({ inserted: count });
};
