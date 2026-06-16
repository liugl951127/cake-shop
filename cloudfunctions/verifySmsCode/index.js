// cloudfunctions/verifySmsCode/index.js
// 校验短信验证码
//
// 入参: { phone, code }
// 出参: { verified, verifyToken (一次性, 用于后续业务) }

const { ok, fail, logger, authOptional, ErrorCode, SmsCode, cryptoBox } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const { phone, code, purpose } = event;
  if (!phone) return fail('手机号必填', ErrorCode.BAD_REQUEST);
  if (!code) return fail('验证码必填', ErrorCode.SMS_CODE_FORMAT_ERROR);

  try {
    await SmsCode.verify(phone, code);
  } catch (e) {
    logger.warn('sms verify failed', { phone: cryptoBox.mask(phone, 'phone'), err: e.message });
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.SMS_CODE_INCORRECT);
  }

  // 签发一次性 verifyToken
  const verifyToken = cryptoBox.generateSecureToken({
    phone, purpose: purpose || 'verify',
    verifiedAt: Date.now()
  }, 600);

  logger.info('sms verified, verifyToken issued', { purpose });
  return ok({ verified: true, verifyToken });
});
