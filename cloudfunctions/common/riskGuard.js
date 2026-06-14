// riskGuard - 统一风控守卫
// 用法:
//   const { guard } = require('../common/riskGuard.js');
//   const r = await guard(event, { scenario: 'pay', amount });
//   if (r.decision === 'reject') throw new BizError(r.message, ErrorCode.RISK_REJECT);
//   if (r.decision === 'verify') return ok({ needVerify: true, ... });
//   if (r.decision === 'manual') return ok({ pendingReview: true, ... });
const { cloud, logger, ErrorCode, BizError } = require('./index.js');

/**
 * 失败开放: 风控引擎挂了不挡业务,只记日志
 */
async function guard(event, params) {
  try {
    const res = await cloud.callFunction({
      name: 'riskEngine',
      data: {
        action: 'check',
        ...params,
        _userId: event._userId,
        _userName: event._userName
      }
    });
    if (!res.result || res.result.code !== 0) {
      logger.warn('[riskGuard] engine call fail, fail-open', {
        code: res.result && res.result.code,
        msg: res.result && res.result.msg
      });
      return { decision: 'pass', message: 'engine_fail' };
    }
    const r = res.result.data;
    const messages = {
      reject: '操作已被风控拦截',
      verify: '需要补充身份验证',
      manual: '正在人工审核,请稍候',
      pass: 'ok'
    };
    return { ...r, message: messages[r.decision] || 'ok' };
  } catch (e) {
    logger.error('[riskGuard] exception, fail-open', e, { scenario: params.scenario });
    return { decision: 'pass', message: 'error' };
  }
}

/**
 * 便捷 throw 模式:
 *   await guardOrThrow(event, { scenario: 'pay', amount });
 *   // 风控通过继续执行;reject 直接抛错;verify/manual 返回需特殊处理
 */
async function guardOrThrow(event, params) {
  const r = await guard(event, params);
  if (r.decision === 'reject') {
    throw new BizError(r.message, ErrorCode.RISK_REJECT, {
      factors: r.factors,
      logId: r.logId
    });
  }
  return r;
}

module.exports = { guard, guardOrThrow };
