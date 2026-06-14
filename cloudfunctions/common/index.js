// common/index.js - 云函数公共模块
const cloud = require('wx-server-sdk');
const { verifyToken, getCachedToken, revokeToken } = require('./token.js');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

class BizError extends Error {
  constructor(msg, code = -1) {
    super(msg);
    this.code = code;
  }
}

const ok = (data = null) => ({ code: 0, msg: 'ok', data });
const fail = (msg, code = -1) => ({ code, msg, data: null });

/**
 * 鉴权中间件 - 校验 token,从数据库加载最新用户信息
 * 客户端在 event.token 传入 token
 */
const auth = (handler) => async (event, context) => {
  try {
    const token = event.token || '';
    if (!token) return fail('未登录', -401);

    // 1. 验证 token 签名
    const payload = verifyToken(token);
    if (!payload) return fail('登录已失效,请重新登录', -401);

    // 2. 查缓存(命中则直接放行)
    let info = getCachedToken(token);

    // 3. 缓存未命中,实时查 db 一次并写回
    if (!info) {
      const db = cloud.database();
      const user = await db.collection('users').doc(payload._id).get().catch(() => null);
      if (!user || !user.data) return fail('用户不存在', -401);
      info = {
        _id: user.data._id,
        openid: user.data.openid,
        isAdmin: !!user.data.isAdmin
      };
    }

    event._openid = info.openid;
    event._userId = info._id;
    event._isAdmin = info.isAdmin;
    event._token = token;

    return await handler(event, context);
  } catch (e) {
    console.error(e);
    if (e instanceof BizError) return fail(e.message, e.code);
    return fail(e.message || '系统异常', -500);
  }
};

const requireAdmin = (event) => {
  if (!event._isAdmin) throw new BizError('无权限', -403);
};

/**
 * 获取当前数据库实例(供子函数复用)
 */
const db = () => cloud.database();

module.exports = {
  cloud,
  db,
  BizError,
  ok,
  fail,
  auth,
  requireAdmin,
  revokeToken
};
