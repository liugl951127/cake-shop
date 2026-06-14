// riskGuard - 统一风控守卫
// 任何业务云函数可在关键动作前调用
//   const guard = await requireRiskGuard(event, { scenario, ... });
//   if (guard.decision === 'reject') return fail(guard.message, -403);
//   if (guard.decision === 'verify') return ok({ needVerify: true, requireAction: guard.requireAction });
//   if (guard.decision === 'manual') return ok({ pendingReview: true, riskLogId: guard.logId });
const { cloud } = require('./index.js');

async function guard(event, params) {
  // params: { scenario, userId, openid, deviceId, ip, phone, idCardHash, orderId, amount, extra }
  try {
    const res = await cloud.callFunction({
      name: 'riskEngine',
      data: {
        action: 'check',
        ...params,
        // 传递审计身份
        _userId: event._userId,
        _userName: event._userName
      }
    });
    if (!res.result || res.result.code !== 0) {
      // 风控调用失败: 失败开放(放行 + 记录)
      console.warn('[riskGuard] engine fail, allow');
      return { decision: 'pass', message: 'engine_fail' };
    }
    const r = res.result.data;
    let message = '';
    if (r.decision === 'reject') message = '操作已被风控拦截';
    else if (r.decision === 'verify') message = '需要补充身份验证';
    else if (r.decision === 'manual') message = '正在人工审核,请稍候';
    return { ...r, message };
  } catch (e) {
    console.error('[riskGuard] fail:', e.message);
    return { decision: 'pass', message: 'error' };
  }
}

module.exports = { guard };
