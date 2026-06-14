// src/routes/seo.js - sitemap / robots / rss
const Router = require('koa-router');
const router = new Router();
const goods = require('../services/goods');

router.get('/sitemap.xml', async (ctx) => {
  const base = process.env.SITE_URL;
  const cats = await goods.getCategories();
  const urls = [
    { loc: base, priority: 1.0, changefreq: 'daily' },
    ...cats.map(c => ({ loc: `${base}/category/${c._id}`, priority: 0.8, changefreq: 'daily' })),
    { loc: `${base}/goods`, priority: 0.9, changefreq: 'daily' }
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  ctx.type = 'application/xml';
  ctx.body = xml;
});

router.get('/robots.txt', async (ctx) => {
  const base = process.env.SITE_URL;
  ctx.type = 'text/plain';
  ctx.body = `User-agent: *
Allow: /
Disallow: /admin
Sitemap: ${base}/sitemap.xml`;
});

module.exports = router;
