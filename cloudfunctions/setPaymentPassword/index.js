// cloudfunctions/setPaymentPassword/index.js
// 设置 / 修改付款密码
//   入参: { userId, password (一次性 token) }
//   - 校验格式
//   - 走加密机 hash
//   - 存 user_secure_fields.paymentPassword (DB)
//   - 不返回明文

const { cloud, ok, fail, logger, authOptional, ErrorCode, PaymentPassword, cryptoBox } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const { userId, password, oldPassword } = event;

  if (!userId) return fail('userId 必填', ErrorCode.BAD_REQUEST);

  // 从一次性 token 解析 password
  let pwd = password;
  if (password && password.startsWith('st_')) {
    try {
      const payload = cryptoBox.consumeSecureToken(password);
      pwd = payload.password;
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail('密码 token 无效', ErrorCode.SECURE_FIELD_INVALID);
    }
  }

  if (!pwd) return fail('密码必填', ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR);

  // 查旧 hash
  const oldDoc = await db.collection('user_secure_fields').where({ userId }).limit(1).get()
    .then(r => r.data && r.data[0])
    .catch(() => null);

  let newHash;
  if (oldDoc && oldDoc.paymentPassword) {
    // 修改密码
    if (!oldPassword) return fail('原密码必填', ErrorCode.PAYMENT_PASSWORD_INCORRECT);
    let oldPwd = oldPassword;
    if (oldPassword.startsWith('st_')) {
      try {
        oldPwd = cryptoBox.consumeSecureToken(oldPassword).password;
      } catch (e) {
        if (e.code) return fail(e.message, e.code);
        return fail('原密码 token 无效', ErrorCode.SECURE_FIELD_INVALID);
      }
    }
    try {
      newHash = await PaymentPassword.change(oldPwd, pwd, {
        salt: oldDoc.paymentPassword.salt,
        hash: oldDoc.paymentPassword.hash,
        iters: oldDoc.paymentPassword.iters,
        alg: oldDoc.paymentPassword.alg
      }, { userId });
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail(e.message, ErrorCode.PAYMENT_PASSWORD_INCORRECT);
    }
  } else {
    // 设置新密码
    newHash = PaymentPassword.set(pwd);
  }

  // 写 DB
  const now = Date.now();
  const updateData = {
    userId,
    paymentPassword: {
      salt: newHash.salt,
      hash: newHash.hash,
      iters: newHash.iters,
      alg: newHash.alg,
      setAt: newHash.ts
    },
    updatedAt: now
  };
  if (oldDoc) {
    await db.collection('user_secure_fields').doc(oldDoc._id).update({ data: updateData });
  } else {
    await db.collection('user_secure_fields').add({
      data: Object.assign({ createdAt: now }, updateData)
    });
  }

  logger.info('payment password updated', { userId, action: oldDoc ? 'change' : 'set' });
  return ok({ set: true, setAt: newHash.ts });
});
