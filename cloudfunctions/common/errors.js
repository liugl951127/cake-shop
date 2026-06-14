// common/errors.js - 统一错误码 + 异常体系
// 用法:
//   const { BizError, ErrorCode, ok, fail } = require('../common/errors.js');
//   throw new BizError('用户不存在', ErrorCode.NOT_FOUND);
//   return ok({ user });
//   return fail('参数错误', ErrorCode.BAD_REQUEST);

const ErrorCode = {
  // 通用 0/-1
  OK: 0,
  FAIL: -1,

  // 业务错误 1xxx
  BAD_REQUEST: 1001,          // 参数错误
  UNAUTHORIZED: 1002,         // 未登录
  TOKEN_EXPIRED: 1003,        // token 失效
  FORBIDDEN: 1004,            // 无权限
  NOT_FOUND: 1005,            // 资源不存在
  CONFLICT: 1006,             // 资源冲突
  RATE_LIMIT: 1007,           // 限流
  EXPIRED: 1008,              // 已过期
  USED: 1009,                 // 已使用
  OUT_OF_STOCK: 1010,         // 库存不足
  AMOUNT_INVALID: 1011,       // 金额无效
  RISK_REJECT: 1012,          // 风控拒绝
  RISK_VERIFY: 1013,          // 风控要求补认证
  RISK_REVIEW: 1014,          // 风控转人工

  // 业务错误 2xxx
  ORDER_NOT_FOUND: 2001,
  ORDER_STATUS_INVALID: 2002,
  ORDER_PAID: 2003,
  ORDER_REFUNDING: 2004,
  COUPON_USED: 2101,
  COUPON_EXPIRED: 2102,
  COUPON_NOT_MATCH: 2103,
  POINTS_NOT_ENOUGH: 2201,
  INVENTORY_NOT_ENOUGH: 2301,
  PERMISSION_DENIED: 2401,

  // 客服/聊天 3xxx
  CHAT_SESSION_NOT_FOUND: 3001,
  CHAT_SESSION_CLOSED: 3002,
  CHAT_NOT_PARTICIPANT: 3003,
  CHAT_MESSAGE_TOO_LONG: 3004,
  CHAT_MESSAGE_INVALID: 3005,
  CHAT_UPLOAD_FAILED: 3006,
  CHAT_RICH_TEXT_INVALID: 3007,

  // 行为埋点 4xxx
  BEHAVIOR_LOG_INVALID: 4001,
  BEHAVIOR_LOG_TOO_LARGE: 4002,
  BEHAVIOR_DEVICE_NOT_FOUND: 4003,
  HISTORY_QUERY_TOO_MANY: 4101,
  HISTORY_EXPORT_FAILED: 4102,

  // 多租户 42xx
  TENANT_NOT_FOUND: 4201,
  TENANT_DISABLED: 4202,
  TENANT_EXPIRED: 4203,
  TENANT_QUOTA_EXCEEDED: 4204,
  TENANT_ISOLATION_DENIED: 4205,

  // 审计/回溯 43xx
  AUDIT_LOG_FAILED: 4301,
  REPLAY_SNAPSHOT_MISSING: 4302,
  REPLAY_EXPIRED: 4303,

  // 性能/监控 44xx
  METRIC_INVALID: 4401,
  METRIC_AGGREGATE_FAILED: 4402,
  ALREADY_REPORTED: 4403,

  // 设备/兼容性 45xx
  DEVICE_INFO_INVALID: 4501,
  UNSUPPORTED_PLATFORM: 4502,
  SCREEN_BREAKPOINT_INVALID: 4503,

  // 断线/重连 46xx
  WS_DISCONNECTED: 4601,
  WS_RECONNECT_FAILED: 4602,
  WS_SESSION_LOST: 4603,
  WS_HEARTBEAT_TIMEOUT: 4604,

  // 离线操作 47xx
  OFFLINE_OP_TOO_OLD: 4701,
  OFFLINE_OP_INVALID: 4702,
  OFFLINE_OP_REPLAY_DUPLICATE: 4703,
  OFFLINE_OP_PAYLOAD_TOO_LARGE: 4704,

  // 系统错误 5xxx
  SYSTEM_ERROR: 5000,
  DB_ERROR: 5001,
  CACHE_ERROR: 5002,
  EXTERNAL_API_ERROR: 5003,
  TIMEOUT: 5004
};

// 错误码 -> 默认提示
const ErrorMessage = {
  [ErrorCode.OK]: 'ok',
  [ErrorCode.FAIL]: '操作失败',
  [ErrorCode.BAD_REQUEST]: '参数错误',
  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已失效,请重新登录',
  [ErrorCode.FORBIDDEN]: '无权限',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.RATE_LIMIT]: '操作太频繁',
  [ErrorCode.EXPIRED]: '已过期',
  [ErrorCode.USED]: '已使用',
  [ErrorCode.OUT_OF_STOCK]: '库存不足',
  [ErrorCode.AMOUNT_INVALID]: '金额无效',
  [ErrorCode.RISK_REJECT]: '操作已被风控拦截',
  [ErrorCode.RISK_VERIFY]: '需要补充身份验证',
  [ErrorCode.RISK_REVIEW]: '正在人工审核',
  [ErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [ErrorCode.ORDER_STATUS_INVALID]: '订单状态错误',
  [ErrorCode.ORDER_PAID]: '订单已支付',
  [ErrorCode.ORDER_REFUNDING]: '订单退款中',
  [ErrorCode.COUPON_USED]: '优惠券已使用',
  [ErrorCode.COUPON_EXPIRED]: '优惠券已过期',
  [ErrorCode.COUPON_NOT_MATCH]: '优惠券不满足条件',
  [ErrorCode.POINTS_NOT_ENOUGH]: '积分不足',
  [ErrorCode.INVENTORY_NOT_ENOUGH]: '库存不足',
  [ErrorCode.PERMISSION_DENIED]: '权限不足',
  // 客服 3xxx
  [ErrorCode.CHAT_SESSION_NOT_FOUND]: '会话不存在',
  [ErrorCode.CHAT_SESSION_CLOSED]: '会话已关闭',
  [ErrorCode.CHAT_NOT_PARTICIPANT]: '非会话参与方',
  [ErrorCode.CHAT_MESSAGE_TOO_LONG]: '消息内容过长',
  [ErrorCode.CHAT_MESSAGE_INVALID]: '消息格式错误',
  [ErrorCode.CHAT_UPLOAD_FAILED]: '文件上传失败',
  [ErrorCode.CHAT_RICH_TEXT_INVALID]: '富文本格式不合法',
  // 行为 4xxx
  [ErrorCode.BEHAVIOR_LOG_INVALID]: '行为日志格式错误',
  [ErrorCode.BEHAVIOR_LOG_TOO_LARGE]: '行为日志过大',
  [ErrorCode.BEHAVIOR_DEVICE_NOT_FOUND]: '设备指纹未识别',
  [ErrorCode.HISTORY_QUERY_TOO_MANY]: '查询范围过大',
  [ErrorCode.HISTORY_EXPORT_FAILED]: '导出失败',
  // 多租户
  [ErrorCode.TENANT_NOT_FOUND]: '租户不存在',
  [ErrorCode.TENANT_DISABLED]: '租户已禁用',
  [ErrorCode.TENANT_EXPIRED]: '租户已到期',
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: '租户额度已用完',
  [ErrorCode.TENANT_ISOLATION_DENIED]: '不允许跨租户访问',
  // 审计/回放
  [ErrorCode.AUDIT_LOG_FAILED]: '审计日志记录失败',
  [ErrorCode.REPLAY_SNAPSHOT_MISSING]: '回放快照缺失',
  [ErrorCode.REPLAY_EXPIRED]: '回放记录已过期',
  // 监控
  [ErrorCode.METRIC_INVALID]: '指标格式错误',
  [ErrorCode.METRIC_AGGREGATE_FAILED]: '指标聚合失败',
  [ErrorCode.ALREADY_REPORTED]: '已上报过同一错误',
  // 设备
  [ErrorCode.DEVICE_INFO_INVALID]: '设备信息格式错误',
  [ErrorCode.UNSUPPORTED_PLATFORM]: '不支持的平台',
  [ErrorCode.SCREEN_BREAKPOINT_INVALID]: '屏幕断点不合法',
  // WS
  [ErrorCode.WS_DISCONNECTED]: 'WS连接已断开',
  [ErrorCode.WS_RECONNECT_FAILED]: 'WS重连失败',
  [ErrorCode.WS_SESSION_LOST]: 'WS会话丢失',
  [ErrorCode.WS_HEARTBEAT_TIMEOUT]: 'WS心跳超时',
  // 离线
  [ErrorCode.OFFLINE_OP_TOO_OLD]: '离线操作已过期',
  [ErrorCode.OFFLINE_OP_INVALID]: '离线操作格式错误',
  [ErrorCode.OFFLINE_OP_REPLAY_DUPLICATE]: '离线操作重复回放',
  [ErrorCode.OFFLINE_OP_PAYLOAD_TOO_LARGE]: '离线操作包过大',
  [ErrorCode.SYSTEM_ERROR]: '系统异常',
  [ErrorCode.DB_ERROR]: '数据库异常',
  [ErrorCode.CACHE_ERROR]: '缓存异常',
  [ErrorCode.EXTERNAL_API_ERROR]: '外部服务异常',
  [ErrorCode.TIMEOUT]: '请求超时'
};

class BizError extends Error {
  constructor(msg, code = ErrorCode.FAIL, data = null) {
    super(msg);
    this.name = 'BizError';
    this.code = code;
    this.data = data;
  }
}

// 把异常转成 { code, msg, data }
function errorToResponse(err) {
  if (err instanceof BizError) {
    return { code: err.code, msg: err.msg || ErrorMessage[err.code] || '操作失败', data: err.data };
  }
  return { code: ErrorCode.SYSTEM_ERROR, msg: err.message || '系统异常', data: null };
}

const ok = (data = null, msg = 'ok') => ({ code: ErrorCode.OK, msg, data });
const fail = (msg, code = ErrorCode.FAIL, data = null) => ({ code, msg, data });

module.exports = {
  ErrorCode,
  ErrorMessage,
  BizError,
  errorToResponse,
  ok,
  fail
};
