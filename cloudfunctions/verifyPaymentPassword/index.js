// cloudfunctions/verifyPaymentPassword/index.js
// 校验付款密码(支付流程中使用)
//
// 入参: { userId, password (一次性 token), businessKey }
// 出参: { ok, token (一次性支付 token) }
//
// 流程:
//   1. 校验格式
//   2. 风控检查(锁定/错误次数)
//   3. 校验 hash
//   4. 成功后返回一次性支付 token(用于接下来的下单/转账)

const { cloud, ok, fail, logger, authOptional, ErrorCode, PaymentPassword, cryptoBox } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const { userId, password, businessKey, businessData } = event;

  if (!userId) return fail('userId 必填', ErrorCode.BAD_REQUEST);
  if (!password) return fail('密码必填', ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR);

  // 解析一次性 token
  let pwd = password;
  if (password.startsWith('st_')) {
    try {
      pwd = cryptoBox.consumeSecureToken(password).password;
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail('密码 token 无效', ErrorCode.SECURE_FIELD_INVALID);
    }
  }

  // 查 hash
  const doc = await db.collection('user_secure_fields').where({ userId }).limit(1).get()
    .then(r => r.data && r.data[0])
    .catch(() => null);
  if (!doc || !doc.paymentPassword || !doc.paymentPassword.hash) {
    return fail('尚未设置付款密码', ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR);
  }

  // 校验
  try {
    const r = await PaymentPassword.verify(pwd, {
      salt: doc.paymentPassword.salt,
      hash: doc.paymentPassword.hash,
      iters: doc.paymentPassword.iters,
      alg: doc.paymentPassword.alg
    }, { userId });
  } catch (e) {
    logger.warn('payment password verify failed', { userId, err: e.message });
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.PAYMENT_PASSWORD_INCORRECT);
  }

  // 成功,签发支付 token
  const payToken = cryptoBox.generateSecureToken({
    userId,
    businessKey: businessKey || 'pay',
    businessData: businessData || {},
    verifiedAt: Date.now()
  }, 300);

  logger.info('payment password verified, pay token issued', { userId, businessKey });
  return ok({ verified: true, payToken });
});
