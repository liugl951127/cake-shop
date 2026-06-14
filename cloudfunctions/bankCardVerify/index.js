// bankCardVerify - 银行卡四要素认证
// 1. 姓名
// 2. 身份证
// 3. 银行卡号
// 4. 银行预留手机号
// 真实环境: 调第三方(腾讯云/阿里云/银联)接口
const { cloud, ok, fail, auth } = require('../common/index.js');

const BANK_BIN = [
  // 6 位 BIN 段,演示用
  { bin: '622202', bank: '工商银行', type: 'debit' },
  { bin: '622848', bank: '工商银行', type: 'debit' },
  { bin: '622700', bank: '建设银行', type: 'debit' },
  { bin: '622262', bank: '建设银行', type: 'debit' },
  { bin: '622588', bank: '招商银行', type: 'debit' },
  { bin: '622576', bank: '招商银行', type: 'debit' },
  { bin: '622155', bank: '农业银行', type: 'debit' },
  { bin: '622848', bank: '工商银行', type: 'debit' },
  { bin: '621785', bank: '中国银行', type: 'debit' }
];

// Luhn 校验
function luhnCheck(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBank(num) {
  for (const b of BANK_BIN) {
    if (num.startsWith(b.bin)) return b;
  }
  return { bank: '未知', type: 'debit' };
}

exports.main = auth(async (event) => {
  const { name, idCard, bankCard, phone, smsCode = '' } = event;
  if (!name || !idCard || !bankCard || !phone) return fail('四要素必填');
  if (!/^1\d{10}$/.test(phone)) return fail('手机号格式错误');
  if (!/^\d{16,19}$/.test(bankCard)) return fail('银行卡号格式错误');
  if (!luhnCheck(bankCard)) return fail('银行卡号校验失败');

  // 短信验证码校验
  if (smsCode) {
    const db = cloud.database();
    const rec = await db.collection('smsCodes')
      .where({ phone, code: smsCode, used: false })
      .orderBy('createTime', 'desc')
      .limit(1)
      .get();
    if (!rec.data[0] || rec.data[0].expireTime < Date.now()) {
      return fail('短信验证码错误或已过期');
    }
    await db.collection('smsCodes').doc(rec.data[0]._id).update({
      data: { used: true, useTime: Date.now() }
    });
  }

  // 实名一致性
  const user = await cloud.database().collection('users').doc(event._userId).get();
  if (user.data && user.data.realNameVerified && user.data.realName !== name) {
    return fail('姓名与已认证信息不一致');
  }
  if (user.data && user.data.idCardHash && user.data.idCardHash !== hashIdCard(idCard)) {
    return fail('身份证与已认证信息不一致');
  }

  // 真实环境: 调第三方
  const USE_REAL_API = process.env.BANK_VERIFY_API;
  if (USE_REAL_API) {
    try {
      const https = require('https');
      const postData = JSON.stringify({ name, idCard, bankCard, phone });
      const apiRes = await new Promise((resolve, reject) => {
        const req = https.request(USE_REAL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(JSON.parse(data)));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
      });
      if (!apiRes.match) return fail('四要素认证不通过', -1);
    } catch (e) {
      return fail('认证服务异常: ' + e.message);
    }
  }

  // 记录
  const bankInfo = detectBank(bankCard);
  const masked = bankCard.substr(0, 4) + ' **** **** ' + bankCard.substr(-4);
  const now = Date.now();
  await cloud.database().collection('bankVerifications').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      name,
      idCardHash: hashIdCard(idCard),
      bankCardHash: hashIdCard(bankCard),
      bankCardMask: masked,
      bank: bankInfo.bank,
      cardType: bankInfo.type,
      phone,
      status: 1,
      createTime: now
    }
  });
  await cloud.database().collection('users').doc(event._userId).update({
    data: {
      bankVerified: true,
      bankVerifyTime: now,
      defaultBankCard: masked
    }
  });

  return ok({
    verified: true,
    bank: bankInfo.bank,
    cardType: bankInfo.type,
    masked
  });
});

function hashIdCard(id) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(id + (process.env.SALT || 'cake_shop_2024')).digest('hex');
}
