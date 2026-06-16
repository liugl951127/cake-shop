// utils/env.js - 环境检测
function isMp() {
  return typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function';
}

function isDevtools() {
  if (!isMp()) return false;
  try {
    const info = wx.getSystemInfoSync();
    return info.platform === 'devtools';
  } catch (e) {
    return false;
  }
}

function isIos() {
  try {
    return wx.getSystemInfoSync().system.indexOf('iOS') >= 0;
  } catch (e) {
    return false;
  }
}

function isAndroid() {
  try {
    return wx.getSystemInfoSync().system.indexOf('Android') >= 0;
  } catch (e) {
    return false;
  }
}

module.exports = { isMp, isDevtools, isIos, isAndroid };
