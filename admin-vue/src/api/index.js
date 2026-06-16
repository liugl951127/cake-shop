import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const http = axios.create({
  baseURL: '/api',
  timeout: 15000
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('__admin_token__')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // 内部 RPC 调用(如云函数中转)需要 X-Internal-Token
  if (config.url && config.url.startsWith('/internal/')) {
    const rpcToken = import.meta.env.VITE_RPC_TOKEN || ''
    if (rpcToken) config.headers['X-Internal-Token'] = rpcToken
  }
  return config
})

http.interceptors.response.use(
  (res) => {
    const r = res.data
    if (r && r.code !== 0) {
      if (r.code === 401 || r.code === 4101) {
        ElMessage.error('登录已过期')
        localStorage.removeItem('__admin_token__')
        router.push('/login')
      } else {
        ElMessage.error(r.msg || `错误 ${r.code}`)
      }
      return Promise.reject(r)
    }
    return r.data
  },
  (err) => {
    if (err.response && err.response.status === 401) {
      ElMessage.error('登录已过期')
      router.push('/login')
    } else {
      ElMessage.error(err.message || '网络错误')
    }
    return Promise.reject(err)
  }
)

export default http

// ==================== 模块 ====================
export const auth = {
  login: (data) => http.post('/auth/login', data, { baseURL: '' }).then(r => r),
  logout: () => http.post('/auth/logout')
}

export const goods = {
  list: (params) => http.get('/v1/admin/goods/list', { params }),
  onSale: (id) => http.post(`/v1/admin/goods/${id}/on-sale`),
  offSale: (id) => http.post(`/v1/admin/goods/${id}/off-sale`),
  updatePrice: (id, body) => http.put(`/v1/admin/goods/${id}/price`, body),
  updateStock: (id, body) => http.put(`/v1/admin/goods/${id}/stock`, body),
  batch: (body) => http.post('/v1/admin/goods/batch', body)
}

export const orders = {
  list: (params) => http.get('/v1/admin/orders/list', { params }),
  ship: (id, body) => http.post(`/v1/admin/orders/${id}/ship`, body),
  refund: (id, body) => http.post(`/v1/admin/orders/${id}/refund`, body)
}

export const members = {
  list: (params) => http.get('/v1/admin/members/list', { params }),
  adjust: (userId, body) => http.post(`/v1/admin/members/${userId}/adjust`, body)
}

export const marketing = {
  list: (type, params) => http.get(`/v1/admin/marketing/${type}/list`, { params }),
  create: (type, body) => http.post(`/v1/admin/marketing/${type}`, body),
  update: (type, id, body) => http.put(`/v1/admin/marketing/${type}/${id}`, body),
  remove: (type, id) => http.delete(`/v1/admin/marketing/${type}/${id}`),
  toggle: (type, id) => http.post(`/v1/admin/marketing/${type}/${id}/toggle`)
}

export const chat = {
  sessions: (params) => http.get('/v1/admin/chat/sessions', { params }),
  history: (sessionId, params) => http.get(`/v1/admin/chat/sessions/${sessionId}/messages`, { params }),
  send: (sessionId, body) => http.post(`/v1/admin/chat/sessions/${sessionId}/messages`, body),
  close: (sessionId) => http.post(`/v1/admin/chat/sessions/${sessionId}/close`),
  transfer: (sessionId, body) => http.post(`/v1/admin/chat/sessions/${sessionId}/transfer`, body),
  agents: () => http.get('/v1/admin/chat/agents')
}

export const finance = {
  overview: (params) => http.get('/v1/admin/finance/overview', { params }),
  withdraws: (params) => http.get('/v1/admin/finance/withdraws', { params }),
  approveWithdraw: (id) => http.post(`/v1/admin/finance/withdraws/${id}/approve`),
  rejectWithdraw: (id, body) => http.post(`/v1/admin/finance/withdraws/${id}/reject`, body)
}

export const monitor = {
  perf: (params) => http.get('/v1/admin/monitor/perf', { params }),
  errors: (params) => http.get('/v1/admin/monitor/errors', { params }),
  audit: (params) => http.get('/v1/admin/monitor/audit', { params })
}

export const dashboard = {
  overview: () => http.get('/v1/admin/dashboard/overview')
}

// ============================================================
// 内部 RPC(给云函数 / 跨服务调用, 不走 JWT)
//   - 后端会校验 X-Internal-Token
//   - VITE_RPC_TOKEN 在 .env.production 注入
// ============================================================
const rpcHttp = axios.create({
  baseURL: '/internal',
  timeout: 30000
})
rpcHttp.interceptors.request.use((config) => {
  const t = import.meta.env.VITE_RPC_TOKEN || ''
  if (t) config.headers['X-Internal-Token'] = t
  return config
})
rpcHttp.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err)
)

export const rpc = {
  // 云函数任务执行
  invokeCloudfn: (name, data) => rpcHttp.post(`/cloudfn/${name}`, data),
  // 跨服务调用
  call: (service, action, data) => rpcHttp.post(`/${service}/${action}`, data),
  // 内部统计
  internalStats: () => rpcHttp.get('/internal/stats')
}
