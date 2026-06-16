// admin-h5/js/adminApi.js
// 后台 API 统一封装(对 Spring Boot + 云函数)
//   优先 Spring Boot(本地) -> 失败 fallback 到云函数
//   统一错误处理 + 401 自动跳登录

(function (global) {

  // ===== 错误码映射 =====
  const ERROR_MSG = {
    4001: '参数错误',
    4003: '权限不足',
    401: '未登录',
    4101: '未授权',
    4102: '会话过期',
    4103: '无权限',
    5001: '资源不存在',
    5003: '操作不允许',
    5401: '加密机不可用',
    5433: '付款密码已锁定',
    5434: '付款密码错误',
    5442: '验证码错误',
    5443: '验证次数过多',
    5445: '操作太频繁'
  };

  function msgOf(code, defaultMsg) {
    return ERROR_MSG[code] || defaultMsg || ('错误 ' + code);
  }

  // ===== 通用请求(走 Spring Boot) =====
  async function call(url, method, data, options = {}) {
    if (!http.getToken()) {
      location.href = '/pages/login/login.html';
      throw new Error('未登录');
    }
    try {
      const r = await http.request({
        url, method, data,
        timeout: options.timeout || 15000
      });
      if (r && r.code !== 0) {
        if (r.code === 401 || r.code === 4101 || r.code === 4102) {
          App.toast.error('登录已过期');
          setTimeout(() => App.logout(), 800);
        } else {
          App.toast.error(msgOf(r.code, r.msg));
        }
        const err = new Error(r.msg || ('error ' + r.code));
        err.code = r.code;
        err.data = r.data;
        throw err;
      }
      return r.data;
    } catch (e) {
      if (!options.silent) App.toast.error(e.message || '网络错误');
      throw e;
    }
  }

  // ===== 走云函数(wx.cloud.callFunction) =====
  async function cf(name, data, options = {}) {
    // 后台 h5 不在 wx 环境,这里走 HTTP 代理云函数(若有)
    // 否则直接调后端(后端再调云函数)
    // 实际生产: 后端有个 /api/v1/cf/{name} 透传云函数
    try {
      const r = await call(`/cf/${name}`, 'POST', data, options);
      return r;
    } catch (e) {
      if (e.code) throw e;
      throw e;
    }
  }

  // ==================== 模块: 商品 ====================
  const Goods = {
    list: (params) => call('/api/v1/admin/goods/list', 'GET', null, { ...params }),
    onSale: (id) => call(`/api/v1/admin/goods/${id}/on-sale`, 'POST'),
    offSale: (id) => call(`/api/v1/admin/goods/${id}/off-sale`, 'POST'),
    updatePrice: (id, price, originPrice) =>
      call(`/api/v1/admin/goods/${id}/price`, 'PUT', { price, originPrice }),
    updateStock: (id, stock) =>
      call(`/api/v1/admin/goods/${id}/stock`, 'PUT', { stock }),
    batch: (action, ids, payload) =>
      call('/api/v1/admin/goods/batch', 'POST', { action, ids, payload })
  };

  // ==================== 模块: 订单 ====================
  const Order = {
    list: (params) => call('/api/v1/admin/orders/list', 'GET', null, params),
    ship: (id, deliveryInfo) =>
      call(`/api/v1/admin/orders/${id}/ship`, 'POST', deliveryInfo),
    refund: (id, action, amount, reason) =>
      call(`/api/v1/admin/orders/${id}/refund`, 'POST', { action, amount, reason }),
    updateAddress: (id, address) =>
      call(`/api/v1/admin/orders/${id}/address`, 'PUT', address),
    print: (id) => call(`/api/v1/admin/orders/${id}/print`, 'POST')
  };

  // ==================== 模块: 会员 ====================
  const Member = {
    list: (params) => call('/api/v1/admin/members/list', 'GET', null, params),
    detail: (userId) => call(`/api/v1/admin/members/${userId}/detail`, 'GET'),
    adjust: (userId, body) =>
      call(`/api/v1/admin/members/${userId}/adjust`, 'POST', body)
  };

  // ==================== 模块: 营销 ====================
  const Marketing = {
    list: (type, params) =>
      call(`/api/v1/admin/marketing/${type}/list`, 'GET', null, params),
    create: (type, body) =>
      call(`/api/v1/admin/marketing/${type}`, 'POST', body),
    update: (type, id, body) =>
      call(`/api/v1/admin/marketing/${type}/${id}`, 'PUT', body),
    delete: (type, id) =>
      call(`/api/v1/admin/marketing/${type}/${id}`, 'DELETE'),
    toggle: (type, id) =>
      call(`/api/v1/admin/marketing/${type}/${id}/toggle`, 'POST')
  };

  // ==================== 模块: 客服 ====================
  const Chat = {
    sessions: (params) => call('/api/v1/admin/chat/sessions', 'GET', null, params),
    history: (sessionId, params) =>
      call(`/api/v1/admin/chat/sessions/${sessionId}/messages`, 'GET', null, params),
    send: (sessionId, body) =>
      call(`/api/v1/admin/chat/sessions/${sessionId}/messages`, 'POST', body),
    close: (sessionId, body) =>
      call(`/api/v1/admin/chat/sessions/${sessionId}/close`, 'POST', body),
    reopen: (sessionId) =>
      call(`/api/v1/admin/chat/sessions/${sessionId}/reopen`, 'POST'),
    blockUser: (userId, body) =>
      call(`/api/v1/admin/chat/users/${userId}/block`, 'POST', body),
    unblockUser: (userId) =>
      call(`/api/v1/admin/chat/users/${userId}/unblock`, 'POST'),
    transfer: (sessionId, body) =>
      call(`/api/v1/admin/chat/sessions/${sessionId}/transfer`, 'POST', body),
    agents: () => call('/api/v1/admin/chat/agents', 'GET')
  };

  // ==================== 模块: 财务 ====================
  const Finance = {
    overview: (params) => call('/api/v1/admin/finance/overview', 'GET', null, params),
    withdraws: (params) => call('/api/v1/admin/finance/withdraws', 'GET', null, params),
    approveWithdraw: (id) =>
      call(`/api/v1/admin/finance/withdraws/${id}/approve`, 'POST'),
    rejectWithdraw: (id, reason) =>
      call(`/api/v1/admin/finance/withdraws/${id}/reject`, 'POST', { reason }),
    settles: (params) => call('/api/v1/admin/finance/settles', 'GET', null, params),
    createSettle: (body) => call('/api/v1/admin/finance/settles', 'POST', body),
    bills: (params) => call('/api/v1/admin/finance/bills', 'GET', null, params),
    export: (body) => call('/api/v1/admin/finance/export', 'POST', body)
  };

  // ==================== 模块: 监控 ====================
  const Monitor = {
    overview: (params) => call('/api/v1/admin/monitor/overview', 'GET', null, params),
    perf: (params) => call('/api/v1/admin/monitor/perf', 'GET', null, params),
    errors: (params) => call('/api/v1/admin/monitor/errors', 'GET', null, params),
    audit: (params) => call('/api/v1/admin/monitor/audit', 'GET', null, params),
    fingerprint: (params) => call('/api/v1/admin/monitor/fingerprint', 'GET', null, params),
    alerts: (params) => call('/api/v1/admin/monitor/alerts', 'GET', null, params),
    resolveAlert: (id, note) =>
      call(`/api/v1/admin/monitor/alerts/${id}/resolve`, 'POST', { note })
  };

  // ==================== 模块: 仪表盘 ====================
  const Dashboard = {
    overview: () => call('/api/v1/admin/dashboard/overview', 'GET'),
    trend7d: () => call('/api/v1/admin/dashboard/trend7d', 'GET'),
    categoryDistribution: () =>
      call('/api/v1/admin/dashboard/category-distribution', 'GET')
  };

  // ==================== 暴露 ====================
  global.adminApi = {
    Goods, Order, Member, Marketing, Chat, Finance, Monitor, Dashboard,
    cf, msgOf
  };

})(window);
