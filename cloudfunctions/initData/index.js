// initData - 一键灌入演示数据
// 使用方法:在云开发控制台 -> 云函数 -> initData -> 测试,传入 { force: true } 强制覆盖
const { cloud, ok, fail } = require('../common/index.js');

const categories = [
  { _id: 'cat_cake',    name: '蛋糕',  sort: 1, icon: '🎂', status: 1 },
  { _id: 'cat_bread',   name: '面包',  sort: 2, icon: '🍞', status: 1 },
  { _id: 'cat_cookie',  name: '饼干',  sort: 3, icon: '🍪', status: 1 },
  { _id: 'cat_gift',    name: '送礼',  sort: 4, icon: '🎁', status: 1 },
  { _id: 'cat_custom',  name: '定制',  sort: 5, icon: '✨', status: 1 }
];

const goods = [
  {
    _id: 'g_strawberry',
    name: '草莓鲜奶蛋糕',
    desc: '新鲜草莓搭配淡奶油,8寸,适合3-5人',
    price: 168, originPrice: 198,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
    images: [
      'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'
    ],
    category: 'cat_cake', stock: 100, sales: 326,
    recommend: true, status: 1,
    tags: ['热销', '生日首选'],
    specs: [{ name: '尺寸', options: ['6寸', '8寸', '10寸'] }, { name: '甜度', options: ['少糖', '正常', '多糖'] }],
    detailImages: [
      'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=600',
      'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=600'
    ]
  },
  {
    _id: 'g_chocolate',
    name: '经典黑森林蛋糕',
    desc: '德国黑森林工艺,樱桃酒香',
    price: 188, originPrice: 0,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400',
    category: 'cat_cake', stock: 80, sales: 218,
    recommend: true, status: 1,
    tags: ['经典'],
    specs: [{ name: '尺寸', options: ['6寸', '8寸'] }]
  },
  {
    _id: 'g_tiramisu',
    name: '意式提拉米苏',
    desc: '咖啡与马斯卡彭的完美融合',
    price: 98, originPrice: 118,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
    category: 'cat_cake', stock: 50, sales: 412,
    recommend: true, status: 1,
    tags: ['新品'],
    specs: [{ name: '规格', options: ['小杯', '大杯'] }]
  },
  {
    _id: 'g_mango',
    name: '芒果慕斯蛋糕',
    desc: '泰国进口芒果,清爽不腻',
    price: 158, originPrice: 0,
    image: 'https://images.unsplash.com/photo-1557925923-cd4648e211a0?w=400',
    category: 'cat_cake', stock: 60, sales: 178,
    recommend: false, status: 1,
    tags: ['夏季'],
    specs: [{ name: '尺寸', options: ['6寸', '8寸'] }]
  },
  {
    _id: 'g_toast',
    name: '北海道牛奶吐司',
    desc: '柔软拉丝,奶香浓郁',
    price: 28, originPrice: 0,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
    category: 'cat_bread', stock: 200, sales: 1024,
    recommend: true, status: 1,
    tags: ['招牌'],
    specs: []
  },
  {
    _id: 'g_croissant',
    name: '法式黄油可颂',
    desc: '36层折叠,酥脆掉渣',
    price: 18, originPrice: 0,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
    category: 'cat_bread', stock: 300, sales: 856,
    recommend: false, status: 1,
    tags: [],
    specs: []
  },
  {
    _id: 'g_cookie_chips',
    name: '美式巧克力曲奇',
    desc: '北美配方,6块装',
    price: 35, originPrice: 45,
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400',
    category: 'cat_cookie', stock: 500, sales: 672,
    recommend: true, status: 1,
    tags: ['进口'],
    specs: [{ name: '口味', options: ['原味', '巧克力', '抹茶'] }]
  },
  {
    _id: 'g_macaron',
    name: '法式马卡龙礼盒',
    desc: '12颗装,4种口味',
    price: 128, originPrice: 158,
    image: 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=400',
    category: 'cat_gift', stock: 100, sales: 234,
    recommend: true, status: 1,
    tags: ['送礼'],
    specs: [{ name: '口味', options: ['经典', '豪华'] }]
  },
  {
    _id: 'g_custom',
    name: '私人定制蛋糕',
    desc: '提前 3 天预订,支持图片定制',
    price: 268, originPrice: 0,
    image: 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400',
    category: 'cat_custom', stock: 999, sales: 89,
    recommend: false, status: 1,
    tags: ['定制'],
    specs: [{ name: '尺寸', options: ['8寸', '10寸', '12寸', '双层'] }]
  }
];

const banners = [
  { _id: 'b1', id: 1, image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800', url: '', sort: 1, status: 1 },
  { _id: 'b2', id: 2, image: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800', url: '', sort: 2, status: 1 },
  { _id: 'b3', id: 3, image: 'https://images.unsplash.com/photo-1505253213348-cd54c92b37e2?w=800', url: '', sort: 3, status: 1 }
];

exports.main = async (event) => {
  const { force = false } = event;
  const db = cloud.database();
  const results = { categories: 0, goods: 0, banners: 0 };

  try {
    // 分类
    for (const c of categories) {
      try {
        if (force) {
          await db.collection('categories').doc(c._id).remove().catch(() => {});
        }
        const exist = await db.collection('categories').doc(c._id).get().catch(() => null);
        if (!exist || force) {
          await db.collection('categories').add({ data: { ...c, createTime: Date.now() } });
          results.categories++;
        }
      } catch (e) {}
    }

    // 商品
    for (const g of goods) {
      try {
        if (force) {
          await db.collection('goods').doc(g._id).remove().catch(() => {});
        }
        const exist = await db.collection('goods').doc(g._id).get().catch(() => null);
        if (!exist || force) {
          await db.collection('goods').add({ data: { ...g, createTime: Date.now(), updateTime: Date.now() } });
          results.goods++;
        }
      } catch (e) {}
    }

    // 轮播
    for (const b of banners) {
      try {
        if (force) {
          await db.collection('banners').doc(b._id).remove().catch(() => {});
        }
        const exist = await db.collection('banners').doc(b._id).get().catch(() => null);
        if (!exist || force) {
          await db.collection('banners').add({ data: { ...b, createTime: Date.now() } });
          results.banners++;
        }
      } catch (e) {}
    }

    return ok({ message: '初始化完成', inserted: results });
  } catch (e) {
    return fail('初始化失败: ' + e.message);
  }
};
