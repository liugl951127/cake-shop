// realNameVerify - 实名认证(二要素:姓名 + 身份证)
// 真实环境: 调公安部 / 第三方(腾讯云/阿里云)接口
// 这里演示模式: 校验身份证格式 + 写记录
const { cloud, ok, fail, auth } = require('../common/index.js');

const ID_REGEX = /^\d{17}[\dXx]$/;

function validateIdCard(id) {
  if (!ID_REGEX.test(id)) return false;
  // 校验码
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * weights[i];
  return codes[sum % 11] === id[17].toUpperCase();
}

function extractBirth(id) {
  return `${id.substr(6, 4)}-${id.substr(10, 2)}-${id.substr(12, 2)}`;
}

function extractGender(id) {
  return Number(id.substr(16, 1)) % 2 === 0 ? '女' : '男';
}

exports.main = auth(async (event) => {
  const { name, idCard, channel = 'manual' } = event;
  if (!name) return fail('姓名必填');
  if (!idCard) return fail('身份证必填');

  // 1. 格式校验
  if (!validateIdCard(idCard)) return fail('身份证号格式错误');

  // 2. 演示模式:简单通过(生产调公安接口)
  const USE_REAL_API = process.env.VERIFY_API_URL;
  if (USE_REAL_API) {
    try {
      const https = require('https');
      const url = require('url');
      const u = url.parse(USE_REAL_API);
      const postData = JSON.stringify({ name, idCard });
      const apiRes = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: u.hostname, path: u.path, method: 'POST',
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
      if (!apiRes.match) return fail('实名认证不通过(姓名与身份证不匹配)', -1);
    } catch (e) {
      return fail('实名认证服务异常: ' + e.message);
    }
  }

  // 3. 写认证记录
  const db = cloud.database();
  const now = Date.now();
  const verify = {
    _openid: event._openid,
    _userId: event._userId,
    name,
    idCardHash: hashIdCard(idCard),  // 不存明文
    birth: extractBirth(idCard),
    gender: extractGender(idCard),
    address: '',  // 真实 API 会返回地址
    channel,
    status: 1,   // 1-通过 0-未通过
    createTime: now
  };
  await db.collection('verifications').add({ data: verify });

  // 4. 更新用户
  await db.collection('users').doc(event._userId).update({
    data: {
      realName: name,
      realNameVerified: true,
      realNameVerifyTime: now,
      idCardHash: hashIdCard(idCard)
    }
  });

  return ok({
    verified: true,
    name,
    gender: verify.gender,
    birth: verify.birth
  });
});

// 哈希身份证(不可逆,用于同一人识别)
function hashIdCard(id) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(id + (process.env.SALT || 'cake_shop_2024')).digest('hex');
}
