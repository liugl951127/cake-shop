// initGroup - 拼团活动演示数据
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const now = Date.now();

  const activities = [
    {
      goodsId: 'g_strawberry',
      goodsName: '草莓鲜奶蛋糕',
      goodsImage: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
      price: 168,
      groupPrice: 99,
      groupSize: 3,
      stock: 100, sold: 0, status: 1,
      startTime: now, endTime: now + 7 * 86400000
    },
    {
      goodsId: 'g_tiramisu',
      goodsName: '意式提拉米苏',
      goodsImage: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
      price: 98,
      groupPrice: 58,
      groupSize: 2,
      stock: 50, sold: 0, status: 1,
      startTime: now, endTime: now + 7 * 86400000
    }
  ];

  let count = 0;
  for (const a of activities) {
    try {
      const exist = await db.collection('groupActivity').where({ goodsId: a.goodsId }).limit(1).get();
      if (exist.data.length === 0) {
        await db.collection('groupActivity').add({ data: { ...a, createTime: now } });
        count++;
      }
    } catch (e) {}
  }
  return ok({ inserted: count });
};
