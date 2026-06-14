// utils/redirect.js - 通用重定向页模板
// 创建一个空白 .js / .wxml / .json, onLoad 时直接 reLaunch 到目标页
module.exports = function (targetUrl) {
  return {
    onLoad() {
      const pages = getCurrentPages();
      const from = pages.length > 1 ? 'navigateBack' : 'reLaunch';
      if (from === 'navigateBack') wx.navigateBack();
      else wx.reLaunch({ url: targetUrl });
    }
  };
};
