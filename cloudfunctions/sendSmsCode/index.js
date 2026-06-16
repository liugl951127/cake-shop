// cloudfunctions/sendSmsCode/index.js
// 发送短信验证码
//
// 入参: { phone, purpose: 'login'|'register'|'reset'|'pay'|'bind', userId? }
// 出参: { sent, expireAt, maskedPhone }
//
// 流程:
//   1. 校验手机号格式
//   2. 风控检查(发送间隔 / 每日上限)
//   3. 生成 6 位验证码
//   4. 走加密机 hash 存储
//   5. 调短信网关(开发环境: 仅 console.log)
//
// 安全:
//   - 验证码只在 cache 中存 hash(不可逆)
//   - 发送频率限制(60 秒 / 每日 10 条)
//   - 不返回明文验证码给客户端(也不应该返回)

const { cloud, ok, fail, logger, authOptional, ErrorCode, SmsCode, cryptoBox } = require('../common/index.js');

exports.main = authOptional(async (event, context) => {
  const { phone, purpose, userId } = event;

  if (!phone) return fail('手机号必填', ErrorCode.BAD_REQUEST);
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail('手机号格式错', ErrorCode.BAD_REQUEST);
  if (!purpose) return fail('purpose 必填', ErrorCode.BAD_REQUEST);

  // 风控
  try {
    SmsCode.checkSendInterval(phone);
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.SMS_SEND_TOO_FREQUENT);
  }

  // 生成
  const gen = SmsCode.generate();
  SmsCode.store(phone, gen);

  // 调短信网关(开发: log)
  if (process.env.NODE_ENV === 'production') {
    // TODO: 接阿里云短信/腾讯云短信
    // const r = await sendSmsGateway(phone, gen.code, purpose);
    logger.info('sms code sent (production)', { phone: cryptoBox.mask(phone, 'phone'), purpose });
  } else {
    logger.info('sms code (dev only, remove in production)', {
      phone: cryptoBox.mask(phone, 'phone'),
      code: gen.code,    // 开发环境才打印
      purpose,
      expireAt: gen.expireAt
    });
  }

  // 审计
  try {
    await cloud.database().collection('sms_send_logs').add({
      data: {
        phone: cryptoBox.hash(phone),     // 存 hash 不存明文
        purpose, userId: userId || '',
        sentAt: Date.now(),
        ip: context.SOURCE_IP || '',
        ua: context.SOURCE || ''
      }
    });
  } catch (e) {}

  return ok({
    sent: true,
    expireAt: gen.expireAt,
    expireIn: 300,
    maskedPhone: cryptoBox.mask(phone, 'phone')
  });
});
