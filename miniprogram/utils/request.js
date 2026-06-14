// utils/request.js - 云函数统一调用 + 自动注入 token
const { getToken, clearAuth } = require('./auth.js');

function request(name, data = {}, options = {}) {
  const { loading = true, title = '加载中', silent = false } = options;
  if (loading) wx.showLoading({ title, mask: true });

  // 自动注入 token
  const token = getToken();
  const payload = token ? { ...data, token } : { ...data };

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data: payload,
      success: (res) => {
        wx.hideLoading();
        const result = res.result || {};

        // 401:token 失效,清掉本地态
        if (result.code === -401) {
          clearAuth();
          if (!silent) {
            wx.showToast({ title: '登录已失效,请重新登录', icon: 'none' });
            setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 800);
          }
          return reject(result);
        }

        if (result.code === 0) {
          resolve(result.data);
        } else {
          if (!silent) {
            wx.showToast({ title: result.msg || '请求失败', icon: 'none' });
          }
          reject(result);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        if (!silent) wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      }
    });
  });
}

module.exports = { request };
