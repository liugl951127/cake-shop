// admin-h5/js/request.js
// 后台管理端统一请求封装
// 走 Spring Boot 后台(同时支持云函数直连做调试)

(function (global) {
  const API_BASE = (window.__API_BASE__ || '') + '/api';
  const TOKEN_KEY = '__admin_token__';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(path, options = {}) {
    const url = path.startsWith('http') ? path : API_BASE + path;
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body
    });

    if (res.status === 401) {
      setToken('');
      if (window.App && window.App.toast) {
        window.App.toast.error('登录已失效');
      }
      setTimeout(() => location.href = '/pages/login/login.html', 500);
      throw new Error('UNAUTHORIZED');
    }

    let data;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      data = { code: res.ok ? 0 : -1, msg: await res.text(), data: null };
    }

    if (data && data.code !== 0) {
      const msg = data.msg || '请求失败';
      if (window.App && window.App.toast && options.silent !== true) {
        window.App.toast.error(msg);
      }
      throw new Error(msg);
    }
    return data;
  }

  // 简化方法
  const http = {
    get: (path, params) => {
      if (params) {
        const q = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
          .join('&');
        if (q) path += (path.includes('?') ? '&' : '?') + q;
      }
      return request(path, { method: 'GET' });
    },
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    del: (path) => request(path, { method: 'DELETE' }),
    request,
    getToken,
    setToken
  };

  global.http = http;
})(window);
