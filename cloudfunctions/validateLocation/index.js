// cloudfunctions/validateLocation/index.js
// 校验位置(单独接口,富文本中 location 节点使用前可先校)
//
// 入参: { latitude, longitude, accuracy, scope }
// 出参: { valid: true/false, validated: { lat, lng, acc } }

const { ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const authz = require('../common/auth.js');

exports.main = authOptional(async (event, context) => {
  try {
    const r = authz.validateLocation({
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      scope: event.scope || 'CN'
    });
    logger.info('location validated', r);
    return ok({ valid: true, validated: r });
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.AUTH_LOCATION_DENIED);
  }
});
