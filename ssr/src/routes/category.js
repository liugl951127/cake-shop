// src/routes/category.js - 分类页
const Router = require('koa-router');
const router = new Router();
const goods = require('../services/goods');

router.get('/category/:id', async (ctx) => {
  const [list, cats] = await Promise.all([
    goods.getGoodsList(ctx.params.id, '', 1),
    goods.getCategories()
  ]);
  const cat = cats.find(c => c._id === ctx.params.id);
  if (!cat) {
    ctx.status = 404;
    return ctx.body = '404 Not Found';
  }
  ctx.state.seo = {
    title: `${cat.name} - ${process.env.SITE_NAME}`,
    description: `精选${cat.name},新鲜烘焙,用心做好每一块`,
    keywords: `${cat.name},蛋糕,甜点,${process.env.SITE_NAME}`
  };
  await ctx.render('pages/category', { list, category: cat, categories: cats });
});

module.exports = router;
