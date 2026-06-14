// utils/auth.js - 鉴权 + 登录
function login(force = false) {
  return new Promise((resolve, reject) => {
    const cache = wx.getStorageSync('userInfo');
    if (cache && cache.openid && !force) return resolve(cache);

    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: (res) => {
        if (res.result && res.result.code === 0) {
          const info = res.result.data;
          wx.setStorageSync('userInfo', info);
          getApp().globalData.openid = info.openid;
          getApp().globalData.isAdmin = !!info.isAdmin;
          resolve(info);
        } else {
          reject(res.result);
        }
      },
      fail: reject
    });
  });
}

function checkLogin() {
  const info = wx.getStorageSync('userInfo');
  return !!(info && info.openid);
}

function requireLogin() {
  if (!checkLogin()) {
    wx.navigateTo({ url: '/pages/login/login' });
    return false;
  }
  return true;
}

module.exports = { login, checkLogin, requireLogin };
