// src/middleware/views.js - EJS 模板中间件(支持 include)
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

module.exports = (root, opts = {}) => {
  const map = opts.map || { html: 'ejs' };
  return async (ctx, next) => {
    ctx.render = (view, data = {}) => {
      const file = path.join(root, `${view}.${map.html}`);
      const tmpl = fs.readFileSync(file, 'utf8');
      const globals = {
        SITE_NAME: process.env.SITE_NAME,
        SITE_URL: process.env.SITE_URL,
        SITE_DESC: process.env.SITE_DESC,
        _seo: ctx.state.seo || {},
        include: (partialPath, locals = {}) => {
          const partialFile = path.join(root, `${partialPath}.${map.html}`);
          const tpl = fs.readFileSync(partialFile, 'utf8');
          return ejs.render(tpl, { ...globals, ...data, ...locals }, { filename: partialFile });
        }
      };
      const html = ejs.render(tmpl, { ...globals, ...data }, { filename: file });
      ctx.type = 'text/html';
      ctx.body = html;
    };
    await next();
  };
};
