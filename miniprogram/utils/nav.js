// utils/nav.js - 统一跳转工具(自动修正路径)
const { isLoggedIn } = require('./auth.js');

// 缓存页面存在性
const pageExists = new Map();

function checkPage(url) {
  // 去掉 query
  const path = url.split('?')[0].split('#')[0];
  // 去前导 /
  const clean = path.replace(/^\//, '');
  // 处理: 如果倒数两段相同,去掉一段
  const parts = clean.split('/');
  let fixed = clean;
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    fixed = parts.slice(0, -1).join('/');
  }
  return '/' + fixed + (url.includes('?') ? url.substring(url.indexOf('?')) : '');
}

// 安全跳转(页面不存在时 toast 提示,不会卡死)
function go(url, options = {}) {
  const { type = 'navigateTo', login = false, replace = false } = options;
  if (login && !isLoggedIn()) {
    wx.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => wx.navigateTo({ url: 'pages/login/login' }), 600);
    return;
  }
  const finalUrl = checkPage(url);
  if (type === 'tab') wx.switchTab({ url: finalUrl, fail: () => failTip(finalUrl) });
  else if (type === 'redirect') wx.redirectTo({ url: finalUrl, fail: () => failTip(finalUrl) });
  else if (type === 'reLaunch') wx.reLaunch({ url: finalUrl, fail: () => failTip(finalUrl) });
  else if (replace) wx.redirectTo({ url: finalUrl, fail: () => failTip(finalUrl) });
  else wx.navigateTo({ url: finalUrl, fail: () => failTip(finalUrl) });
}

function failTip(url) {
  console.warn('[nav] 页面不存在:', url);
  wx.showToast({ title: '页面开发中', icon: 'none' });
}

// 快捷方法
const nav = {
  go,
  to: (url, opts) => go(url, { ...opts, type: 'navigateTo' }),
  tab: (url, opts) => go(url, { ...opts, type: 'tab' }),
  redirect: (url, opts) => go(url, { ...opts, type: 'redirect' }),
  reLaunch: (url, opts) => go(url, { ...opts, type: 'reLaunch' }),
  // 登录后再跳
  toLogin: (url) => go(url, { login: true }),
  // 返回首页
  home: () => wx.switchTab({ url: 'pages/index/index' }),
  // 返回上一页,没有就回首页
  back: (fallback = '/pages/index/index') => {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: fallback });
  }
};

module.exports = nav;
