// utils/cloud-shim.js
// v36.1+ 静默拦截 wx.cloud.callFunction 错误
//
// 原因:
//   v34.0 已切直连后端, 但代码里仍有 wx.cloud.callFunction 调用
//   (旧逻辑的 fallback, 现在不需要)
//   开发者工具控制台报 [100003] Env Not Exists, 干扰调试
//
// 策略:
//   - 在 app.js 顶部 require 本模块
//   - 替换 wx.cloud.callFunction 为静默版本
//   - 失败时返回 { result: { code: -1, msg: 'cloud-shim-silent' } }
//   - 业务代码 (tracker / monitor / auth) 检测到 code !== 0 自然走 fallback
//
// 不影响:
//   - wx.cloud.init: 仍然初始化(避免其他代码报错)
//   - wx.cloud.database / storage: 不动
//   - 直连后端 (request.js): 不动

(function patchWxCloud() {
  if (typeof wx === 'undefined' || !wx.cloud) return;
  if (wx.cloud.__shimInstalled) return;

  const origCallFunction = wx.cloud.callFunction.bind(wx.cloud);
  wx.cloud.callFunction = function shimCallFunction(opts) {
    if (typeof opts === 'string') opts = { name: opts };
    // dev / 演示环境: 静默
    return new Promise((resolve) => {
      origCallFunction(opts).then(
        (res) => resolve(res),
        (err) => {
          // 静默,不打印 (避免 Env Not Exists 噪声)
          resolve({
            result: { code: -1, msg: 'cloud-shim-silent', err: err && err.errMsg },
            errMsg: 'cloud-shim-silent',
            __shim: true
          });
        }
      );
    });
  };

  wx.cloud.__shimInstalled = true;
  // 静默提示一次 (开发体验)
  if (typeof console !== 'undefined' && console.info) {
    // console.info('[cloud-shim] 已启用 wx.cloud.callFunction 静默拦截');
  }
})();

module.exports = { ready: true };
