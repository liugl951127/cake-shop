// src/app.js - Koa SSR 入口
require('dotenv').config();
const Koa = require('koa');
const Router = require('koa-router');
const Static = require('koa-static');
const BodyParser = require('koa-bodyparser');
const path = require('path');
const views = require('./middleware/views');
const seo = require('./middleware/seo');
const sitemap = require('./middleware/sitemap');
const { initCache } = require('./services/cache');
const { initCloud } = require('./services/cloud');

const app = new Koa();

// 全局错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('[Error]', err);
    ctx.status = err.status || 500;
    ctx.body = process.env.NODE_ENV === 'production'
      ? '500 Server Error'
      : err.stack;
  }
});

// SEO 注入(默认站点信息)
app.use(seo({
  title: process.env.SITE_NAME,
  description: process.env.SITE_DESC,
  keywords: process.env.SITE_KEYWORDS,
  url: process.env.SITE_URL
}));

// 模板引擎
app.use(views(path.join(__dirname, '../views'), {
  map: { html: 'ejs' }
}));

// 静态资源
app.use(Static(path.join(__dirname, '../public'), {
  maxage: 7 * 24 * 60 * 60 * 1000  // 7 天缓存
}));

// body 解析
app.use(BodyParser());

// 路由
const router = new Router();
router.use(require('./routes/home').routes());
router.use(require('./routes/goods').routes());
router.use(require('./routes/category').routes());
router.use(require('./routes/seo').routes());  // sitemap, robots.txt, rss
app.use(router.routes());

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ SSR 启动: http://localhost:${PORT}`);
  await initCache();
  await initCloud();
});
