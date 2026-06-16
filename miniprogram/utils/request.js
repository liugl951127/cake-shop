// utils/request.js - HTTP 直连后端(替代云函数中转)
//
// 策略:
//   - 默认走 wx.request → Spring Boot (api.cakeshop.com)
//   - 内部 RPC(管理后台/云函数) → 走 X-Internal-Token
//   - 自动注入 X-Openid + X-Login-Token
//   - 401 自动跳登录
//
// 切回云函数: 改 USE_DIRECT = false
// 切内部 RPC: 设 options.rpc = true
//
// 后端:
//   - /api/wx/session           换 openid+token
//   - /api/wx/session/logout    登出
//   - /api/internal/**          内部 RPC 路径(走 X-Internal-Token)
//   - /api/...                  业务接口(走 X-Openid + X-Login-Token)

const { getToken, clearAuth, getOpenid } = require('./auth.js');
const { isMp } = require('./env.js');

const USE_DIRECT = true;  // true=直连后端, false=走云函数

// 优先级: globalThis.__BACKEND_URL > DEFAULT_BACKEND_URL
//   - 本地: 改 DEFAULT_BACKEND_URL 或在 app.js onLaunch 设 globalThis.__BACKEND_URL
//   - 线上: 编译前 define 全局变量(开发者工具"详情 → 自定义预处理" 注入)
//   - 默认 127.0.0.1: 避免 "域名不合法" 警告
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8080';
const BACKEND_URL = (typeof globalThis !== 'undefined' && globalThis.__BACKEND_URL) || DEFAULT_BACKEND_URL;

const INTERNAL_RPC_TOKEN = '';  // 内部 RPC token, 需在小程序里设(管理后台用)

/**
 * 统一请求
 * @param {string|object} nameOrOptions - 接口名(/api/xxx) 或 { url, method, data }
 * @param {object} data 请求体
 * @param {object} options { loading, title, silent, rpc, method, headers }
 */
function request(nameOrOptions, data = {}, options = {}) {
  const { loading = true, title = '加载中', silent = false, rpc = false, method, headers } = options;

  // 1. 统一入参
  let url, payload, httpMethod = method || 'POST';
  if (typeof nameOrOptions === 'string') {
    url = BACKEND_URL + (nameOrOptions.startsWith('/') ? nameOrOptions : '/api/' + nameOrOptions);
    payload = data;
  } else {
    url = nameOrOptions.url.startsWith('http') ? nameOrOptions.url : BACKEND_URL + nameOrOptions.url;
    payload = nameOrOptions.data || {};
    httpMethod = nameOrOptions.method || httpMethod;
  }

  // 2. 直连 / 云函数
  if (USE_DIRECT) {
    return httpRequest(url, payload, httpMethod, { loading, title, silent, rpc, headers });
  } else {
    return cloudfnRequest(nameOrOptions, payload, { loading, title, silent });
  }
}

// ============================================================
// HTTP 直连
// ============================================================
function httpRequest(url, data, method, opts) {
  const { loading, title, silent, rpc, headers } = opts;
  if (loading) wx.showLoading({ title, mask: true });

  // 自动注入鉴权头
  const finalHeaders = Object.assign({}, headers || {});
  if (rpc) {
    // 内部 RPC
    if (INTERNAL_RPC_TOKEN) finalHeaders['X-Internal-Token'] = INTERNAL_RPC_TOKEN;
  } else {
    const openid = getOpenid();
    const token = getToken();
    if (openid) finalHeaders['X-Openid'] = openid;
    if (token) finalHeaders['X-Login-Token'] = token;
  }
  finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
  finalHeaders['X-Client'] = 'mp';  // 标识来源

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: finalHeaders,
      success: (res) => {
        if (loading) wx.hideLoading();
        const body = res.data || {};
        const code = body.code !== undefined ? body.code : (res.statusCode === 200 ? 0 : res.statusCode);

        if (code === 0) {
          resolve(body.data);
        } else if (code === 401 || code === -401) {
          clearAuth();
          if (!silent) {
            wx.showToast({ title: '登录已失效', icon: 'none' });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 800);
          }
          reject(body);
        } else if (code === 403) {
          if (!silent) wx.showToast({ title: '无权限访问', icon: 'none' });
          reject(body);
        } else {
          if (!silent) wx.showToast({ title: body.msg || `请求失败(${code})`, icon: 'none' });
          reject(body);
        }
      },
      fail: (err) => {
        if (loading) wx.hideLoading();
        if (!silent) wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      }
    });
  });
}

// ============================================================
// 云函数调用(旧方案, fallback)
// ============================================================
function cloudfnRequest(name, data, opts) {
  const { loading, title, silent } = opts;
  if (loading) wx.showLoading({ title, mask: true });

  const token = getToken();
  const payload = token ? { ...data, token } : { ...data };

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: typeof name === 'string' ? name : name.name,
      data: payload,
      success: (res) => {
        wx.hideLoading();
        const result = res.result || {};
        if (result.code === -401) {
          clearAuth();
          if (!silent) {
            wx.showToast({ title: '登录已失效', icon: 'none' });
            setTimeout(() => wx.reLaunch({ url: '/pages/login/login' }), 800);
          }
          return reject(result);
        }
        if (result.code === 0) resolve(result.data);
        else {
          if (!silent) wx.showToast({ title: result.msg || '请求失败', icon: 'none' });
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

// ============================================================
// 便捷方法
// ============================================================
function get(url, params, options) {
  const q = params ? '?' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&') : '';
  return request({ url: url + q, method: 'GET' }, null, options);
}

function post(url, data, options) {
  return request({ url, method: 'POST', data }, null, options);
}

module.exports = {
  request,
  get,
  post,
  BACKEND_URL,
  USE_DIRECT,
  setInternalRpcToken: (t) => { INTERNAL_RPC_TOKEN = t; }
};
