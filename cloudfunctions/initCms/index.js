// initCms - 初始化 CMS 演示数据
const { cloud, ok } = require('../common/index.js');

const BANNERS = [
  { image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800', title: '新品上市 草莓季', url: '/pages/goods/goods?category=cat_cake', sort: 1, status: 1 },
  { image: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800', title: '会员日 全场 9 折', url: '/pages/member/member', sort: 2, status: 1 },
  { image: 'https://images.unsplash.com/photo-1505253213348-cd54c92b37e2?w=800', title: '满 100 减 10', url: '/pages/coupon/center/center', sort: 3, status: 1 }
];

const NOTICES = [
  { title: '🎉 新人专享 50 元大礼包', content: '新用户注册即可领取 50 元优惠券,满 99 可用', top: true, status: 1 },
  { title: '📢 春节配送公告', content: '春节期间 1/21-1/27 暂停配送,1/28 起恢复正常', top: false, status: 1 },
  { title: '🎂 生日蛋糕提前 24 小时预订', content: '为保证新鲜,生日蛋糕请提前 24 小时下单', top: false, status: 1 }
];

const PAGES = [
  {
    slug: 'about',
    title: '关于我们',
    content: '<h3>甜心蛋糕</h3><p>成立于 2018 年,专注于高品质生日蛋糕、手工面包、法式甜点。</p><p>所有产品当日烘焙,选用进口原料,用心做好每一份甜蜜。</p><p><br></p><h3>联系方式</h3><p>客服电话:400-888-8888</p><p>工作时间:9:00-21:00</p><p>微信公众号:甜心蛋糕</p>',
    status: 1
  },
  {
    slug: 'agreement',
    title: '用户协议',
    content: '<h3>用户协议</h3><p>欢迎使用甜心蛋糕小程序。在使用前,请仔细阅读本协议。</p><p>1. 用户应保证注册信息的真实性</p><p>2. 商品一经售出,非质量问题不退换</p><p>3. 配送范围以小程序显示为准</p><p>4. 最终解释权归甜心蛋糕所有</p>',
    status: 1
  },
  {
    slug: 'privacy',
    title: '隐私政策',
    content: '<h3>隐私政策</h3><p>我们重视您的隐私。本政策说明我们如何收集、使用、存储您的个人信息。</p><p>1. 收集信息:昵称、头像、收货地址、订单信息</p><p>2. 使用信息:仅用于订单履约和客服服务</p><p>3. 不会向第三方共享您的个人信息</p>',
    status: 1
  },
  {
    slug: 'faq',
    title: '常见问题',
    content: '<h3>常见问题</h3><p><strong>Q: 配送多长时间?</strong></p><p>A: 同城 1-2 小时送达,跨城 24-48 小时。</p><p><strong>Q: 如何退款?</strong></p><p>A: 订单详情页申请退款,1-3 个工作日原路退回。</p><p><strong>Q: 优惠券如何使用?</strong></p><p>A: 下单时在"优惠券"栏选择可用券。</p>',
    status: 1
  }
];

exports.main = async () => {
  const db = cloud.database();
  const results = { banners: 0, notices: 0, pages: 0 };

  for (const b of BANNERS) {
    const exist = await db.collection('cmsBanners').where({ title: b.title }).limit(1).get();
    if (exist.data.length === 0) {
      await db.collection('cmsBanners').add({ data: { ...b, createTime: Date.now() } });
      results.banners++;
    }
  }

  for (const n of NOTICES) {
    const exist = await db.collection('cmsNotices').where({ title: n.title }).limit(1).get();
    if (exist.data.length === 0) {
      await db.collection('cmsNotices').add({ data: { ...n, createTime: Date.now() } });
      results.notices++;
    }
  }

  for (const p of PAGES) {
    const exist = await db.collection('cmsPages').where({ slug: p.slug }).limit(1).get();
    if (exist.data.length === 0) {
      await db.collection('cmsPages').add({ data: { ...p, createTime: Date.now() } });
      results.pages++;
    } else {
      // 更新内容
      await db.collection('cmsPages').where({ slug: p.slug }).update({
        data: { content: p.content, title: p.title, updateTime: Date.now() }
      });
    }
  }

  return ok({ message: 'CMS 初始化完成', inserted: results });
};
