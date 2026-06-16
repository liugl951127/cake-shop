// cloudfunctions/secureFieldEncrypt/index.js
// 通用安全字段加密(身份证/银行卡/自定义敏感数据)
//
// 入参: { fieldType: 'idcard'|'bankcard'|'custom', value (一次性 token), keyAlias, ctx }
// 出参: { cipher }

const { ok, fail, logger, authOptional, ErrorCode, SecureField, cryptoBox } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const { fieldType, value, keyAlias, ctx } = event;
  if (!fieldType) return fail('fieldType 必填', ErrorCode.BAD_REQUEST);
  if (!value) return fail('value 必填', ErrorCode.BAD_REQUEST);

  // 解一次性 token
  let v = value;
  if (value.startsWith('st_')) {
    try {
      v = cryptoBox.consumeSecureToken(value).value;
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail('token 无效', ErrorCode.SECURE_FIELD_INVALID);
    }
  }

  // 字段类型校验
  if (fieldType === 'idcard' && !/^\d{17}[\dXx]$/.test(v)) {
    return fail('身份证格式错', ErrorCode.SECURE_FIELD_INVALID);
  }
  if (fieldType === 'bankcard' && !/^\d{16,19}$/.test(v)) {
    return fail('银行卡格式错', ErrorCode.SECURE_FIELD_INVALID);
  }

  const cipher = await SecureField.encrypt({ type: fieldType, value: v }, keyAlias || 'default', ctx || {});
  logger.info('secure field encrypted', { fieldType });
  return ok({ cipher });
});
