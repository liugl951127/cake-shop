// src/routes/home.js - 首页
const Router = require('koa-router');
const router = new Router();
const goods = require('../services/goods');

router.get('/', async (ctx) => {
  const data = await goods.getHomeData();
  ctx.state.seo = {
    title: `${process.env.SITE_NAME} - ${process.env.SITE_DESC}`,
    description: process.env.SITE_DESC,
    keywords: process.env.SITE_KEYWORDS,
    type: 'website'
  };
  await ctx.render('pages/home', data);
});

module.exports = router;
