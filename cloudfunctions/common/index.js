// common/index.js - 云函数公共模块
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 业务异常
class BizError extends Error {
  constructor(msg, code = -1) {
    super(msg);
    this.code = code;
  }
}

// 包装返回
const ok = (data = null) => ({ code: 0, msg: 'ok', data });
const fail = (msg, code = -1) => ({ code, msg, data: null });

// 获取当前用户 openid
const getOpenid = async () => {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || '';
};

// 鉴权中间件
const auth = (handler) => async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return fail('未登录', -401);

    // 标记管理员
    const db = cloud.database();
    const user = await db.collection('users').where({ openid }).limit(1).get();
    event._openid = openid;
    event._isAdmin = !!(user.data[0] && user.data[0].isAdmin);
    event._userId = user.data[0] ? user.data[0]._id : '';

    return await handler(event, context);
  } catch (e) {
    console.error(e);
    if (e instanceof BizError) return fail(e.message, e.code);
    return fail(e.message || '系统异常', -500);
  }
};

// 简单管理员校验
const requireAdmin = (event) => {
  if (!event._isAdmin) throw new BizError('无权限', -403);
};

module.exports = {
  cloud,
  BizError,
  ok,
  fail,
  getOpenid,
  auth,
  requireAdmin
};
