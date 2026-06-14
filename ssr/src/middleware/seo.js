// src/middleware/seo.js - 默认 SEO 信息(后续路由可覆盖)
module.exports = (defaults) => {
  return async (ctx, next) => {
    ctx.state.seo = {
      title: defaults.title,
      description: defaults.description,
      keywords: defaults.keywords,
      image: `${defaults.url}/og-cover.png`,
      url: defaults.url,
      type: 'website',
      ...(ctx.state.seo || {})  // 允许路由覆盖
    };
    await next();
  };
};
