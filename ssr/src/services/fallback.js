// src/services/fallback.js - 静态演示数据(SSR 降级用)
module.exports = {
  homeBanners: [
    { id: 1, image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800', title: '新品上市 草莓季', url: '/goods?category=cat_cake' },
    { id: 2, image: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800', title: '会员日 全场 9 折', url: '/member' }
  ],
  categories: [
    { _id: 'cat_cake', name: '蛋糕', icon: '🎂' },
    { _id: 'cat_bread', name: '面包', icon: '🍞' },
    { _id: 'cat_cookie', name: '饼干', icon: '🍪' },
    { _id: 'cat_gift', name: '送礼', icon: '🎁' }
  ],
  hotGoods: [
    { _id: 'g1', name: '草莓鲜奶蛋糕', price: 168, image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400', desc: '新鲜草莓 8 寸' },
    { _id: 'g2', name: '经典黑森林蛋糕', price: 188, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400', desc: '德国工艺' },
    { _id: 'g3', name: '意式提拉米苏', price: 98, image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400', desc: '咖啡与马斯卡彭' },
    { _id: 'g4', name: '北海道牛奶吐司', price: 28, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', desc: '柔软拉丝' }
  ],
  goods: (id) => {
    const all = [
      { _id: 'g1', name: '草莓鲜奶蛋糕', price: 168, originPrice: 198, image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800', desc: '新鲜草莓搭配淡奶油,8寸,适合3-5人', detail: '<p>精选优质奶油 + 当日采摘草莓</p><p>生日/聚会首选</p>', tags: ['热销', '生日'] },
      { _id: 'g2', name: '经典黑森林蛋糕', price: 188, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800', desc: '德国黑森林工艺,樱桃酒香', detail: '<p>经典传承</p>', tags: ['经典'] },
      { _id: 'g3', name: '意式提拉米苏', price: 98, image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800', desc: '咖啡与马斯卡彭的完美融合', detail: '<p>意式经典</p>', tags: ['新品'] }
    ];
    return all.find(g => g._id === id) || all[0];
  }
};
