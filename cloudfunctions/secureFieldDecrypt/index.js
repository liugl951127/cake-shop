// cloudfunctions/secureFieldDecrypt/index.js
// 解密(只允许服务端调,前端拿不到明文)

const { ok, fail, logger, authOptional, ErrorCode, SecureField, cryptoBox } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const { cipher, keyAlias, ctx } = event;
  if (!cipher) return fail('cipher 必填', ErrorCode.BAD_REQUEST);
  try {
    const value = await SecureField.decrypt(cipher, keyAlias || 'default', ctx || {});
    return ok({ value });
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.DECRYPT_FAILED);
  }
});
