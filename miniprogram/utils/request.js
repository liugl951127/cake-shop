// utils/request.js - 云函数统一调用封装
function request(name, data = {}, options = {}) {
  const { loading = true, title = '加载中' } = options;
  if (loading) wx.showLoading({ title, mask: true });

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        wx.hideLoading();
        const payload = res.result || {};
        if (payload.code === 0) {
          resolve(payload.data);
        } else {
          if (payload.code !== -401) {
            wx.showToast({ title: payload.msg || '请求失败', icon: 'none' });
          }
          reject(payload);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      }
    });
  });
}

module.exports = { request };
