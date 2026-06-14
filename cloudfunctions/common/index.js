// common/index.js - 云函数公共模块(基础平台)
//
// 职责:
//   - 初始化云开发 SDK(单例)
//   - 提供统一响应格式
//   - 鉴权中间件
//   - 业务异常
//   - 错误码
//
// 设计原则: 一次 require,跨请求复用(冷启动友好)
const cloud = require('wx-server-sdk');
const { verifyToken, getCachedToken, revokeToken } = require('./token.js');
const { logger } = require('./logger.js');
const { config } = require('./config.js');
const { cache } = require('./cache.js');
const { BizError, ErrorCode, ErrorMessage, ok, fail, errorToResponse } = require('./errors.js');

// 1. 初始化云开发(单例,云函数复用)
let _initialized = false;
function initCloud() {
  if (_initialized) return cloud;
  try {
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    _initialized = true;
  } catch (e) {
    logger.error('cloud.init failed', e);
    throw e;
  }
  return cloud;
}
initCloud();

// 2. 鉴权中间件
const auth = (handler) => async (event = {}, context) => {
  const token = event.token || '';
  if (!token) return fail('未登录', ErrorCode.UNAUTHORIZED);

  try {
    // 1. 校验 token 签名
    const payload = verifyToken(token);
    if (!payload) return fail('登录已失效', ErrorCode.TOKEN_EXPIRED);

    // 2. 缓存命中
    let info = getCachedToken(token);
    if (!info) {
      // 3. 缓存未命中,查 db 并写回
      const user = await cloud.database().collection('users').doc(payload._id).get().catch(() => null);
      if (!user || !user.data) return fail('用户不存在', ErrorCode.NOT_FOUND);
      info = {
        _id: user.data._id,
        openid: user.data.openid,
        isAdmin: !!user.data.isAdmin
      };
    }

    // 4. 注入上下文(不修改原 event,挂到 context 上一份)
    const enrichedEvent = Object.assign({}, event, {
      _openid: info.openid,
      _userId: info._id,
      _isAdmin: info.isAdmin,
      _token: token
    });

    return await handler(enrichedEvent, context);
  } catch (e) {
    logger.error('auth fail', e, { ip: cloud.getWXContext().CLIENTIP });
    if (e instanceof BizError) return fail(e.message, e.code, e.data);
    return fail(e.message || '系统异常', ErrorCode.SYSTEM_ERROR);
  }
};

const requireAdmin = (event) => {
  if (!event._isAdmin) throw new BizError('无权限', ErrorCode.FORBIDDEN);
};

/**
 * 公开接口鉴权(可选登录):有 token 就解析,没有放行
 * 用于商品列表、文章等公开接口,已登录用户可拿更多上下文
 */
const authOptional = (handler) => async (event = {}, context) => {
  const token = event.token || '';
  if (!token) return await handler(event, context);
  try {
    const payload = verifyToken(token);
    if (payload) {
      const info = getCachedToken(token);
      if (info) {
        event._openid = info.openid;
        event._userId = info._id;
        event._isAdmin = info.isAdmin;
      }
    }
  } catch (e) {
    logger.warn('authOptional token invalid', { err: e.message });
  }
  return await handler(event, context);
};

module.exports = {
  cloud,
  config,
  logger,
  cache,
  BizError,
  ErrorCode,
  ErrorMessage,
  ok,
  fail,
  errorToResponse,
  auth,
  authOptional,
  requireAdmin,
  revokeToken
};
