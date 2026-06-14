// src/routes/goods.js - 商品
const Router = require('koa-router');
const router = new Router();
const goods = require('../services/goods');

// 商品列表
router.get('/goods', async (ctx) => {
  const category = ctx.query.category || '';
  const keyword = ctx.query.keyword || '';
  const page = Number(ctx.query.page) || 1;
  const [list, cats] = await Promise.all([
    goods.getGoodsList(category, keyword, page),
    goods.getCategories()
  ]);
  const currentCat = cats.find(c => c._id === category) || { name: keyword || '全部商品' };
  ctx.state.seo = {
    title: `${currentCat.name} - ${process.env.SITE_NAME}`,
    description: `选购${currentCat.name},新鲜烘焙,用心做好每一块蛋糕`,
    keywords: `${currentCat.name},蛋糕,甜点,${process.env.SITE_NAME}`
  };
  await ctx.render('pages/goods-list', { list, categories: cats, currentCat, keyword, page });
});

// 商品详情
router.get('/goods/:id', async (ctx) => {
  const detail = await goods.getGoodsDetail(ctx.params.id);
  if (!detail) {
    ctx.status = 404;
    return ctx.body = '404 Not Found';
  }
  // 结构化数据(JSON-LD,Google 搜索富媒体)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: detail.name,
    image: detail.image,
    description: detail.desc || detail.name,
    sku: detail._id,
    brand: { '@type': 'Brand', name: process.env.SITE_NAME },
    offers: {
      '@type': 'Offer',
      price: detail.price,
      priceCurrency: 'CNY',
      availability: 'https://schema.org/InStock'
    }
  };
  ctx.state.seo = {
    title: `${detail.name} - ${process.env.SITE_NAME}`,
    description: detail.desc || detail.name,
    keywords: `${detail.name},蛋糕,${(detail.tags || []).join(',')}`,
    image: detail.image,
    type: 'product',
    jsonLd
  };
  await ctx.render('pages/goods-detail', { goods: detail });
});

module.exports = router;
