// initSeckill - 初始化秒杀演示数据
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  const activities = [
    {
      name: '草莓鲜奶蛋糕 - 限时秒杀',
      goodsId: 'g_strawberry',
      image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
      price: 99,
      originPrice: 168,
      stock: 50, total: 50, sold: 0, perLimit: 2,
      startTime: now,
      endTime: now + 2 * 60 * 60 * 1000, // 2 小时
      status: 1
    },
    {
      name: '意式提拉米苏 - 限时秒杀',
      goodsId: 'g_tiramisu',
      image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
      price: 58,
      originPrice: 98,
      stock: 30, total: 30, sold: 0, perLimit: 3,
      startTime: now,
      endTime: now + 24 * 60 * 60 * 1000,
      status: 1
    },
    {
      name: '北海道牛奶吐司 - 限时秒杀',
      goodsId: 'g_toast',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
      price: 15,
      originPrice: 28,
      stock: 100, total: 100, sold: 0, perLimit: 5,
      startTime: now + 60 * 60 * 1000, // 1 小时后开始
      endTime: now + 25 * 60 * 60 * 1000,
      status: 1
    }
  ];

  let count = 0;
  for (const a of activities) {
    try {
      const exist = await db.collection('seckill').where({ goodsId: a.goodsId }).limit(1).get();
      if (exist.data.length === 0) {
        await db.collection('seckill').add({ data: { ...a, createTime: now } });
        count++;
      }
    } catch (e) {}
  }
  return ok({ inserted: count });
};
