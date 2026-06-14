// phoneLogin - 手机号 + 验证码登录
// 1. sendCode: 发送短信验证码
// 2. login: 校验 + 登录
// 真实环境: 短信服务商(腾讯云/阿里云),此处用 6 位随机数演示
const { cloud, ok, BizError } = require('../common/index.js');
const { generateToken, cacheToken } = require('../common/token.js');

const CODE_TTL = 5 * 60 * 1000;  // 5 分钟有效

// 发送验证码
async function sendCode(phone) {
  if (!/^1\d{10}$/.test(phone)) throw new BizError('手机号格式错误');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const db = cloud.database();
  // 存到 smsCodes 集合
  await db.collection('smsCodes').add({
    data: { phone, code, used: false, createTime: Date.now(), expireTime: Date.now() + CODE_TTL }
  });
  // 生产: 调短信 API 发送
  // 此处演示: 在小程序控制台 / 微信开发者工具 云函数日志里查看
  console.log(`[SMS] ${phone} -> ${code}`);
  return code;  // 演示模式直接返回
}

// 登录
async function doLogin(phone, code) {
  if (!/^1\d{10}$/.test(phone)) throw new BizError('手机号格式错误');
  if (!/^\d{6}$/.test(code)) throw new BizError('验证码 6 位');

  const db = cloud.database();
  const _ = db.command;
  // 找最新一条未用的
  const res = await db.collection('smsCodes')
    .where({ phone, used: false })
    .orderBy('createTime', 'desc')
    .limit(1)
    .get();
  if (!res.data[0]) throw new BizError('请先获取验证码');
  const rec = res.data[0];
  if (rec.expireTime < Date.now()) throw new BizError('验证码已过期');
  if (rec.code !== code) throw new BizError('验证码错误');

  // 标记已用
  await db.collection('smsCodes').doc(rec._id).update({
    data: { used: true, useTime: Date.now() }
  });

  // 找/建用户(openid 用 phone 标准化)
  const openid = 'phone_' + phone;
  const exist = await db.collection('users').where({ openid }).limit(1).get();
  const now = Date.now();
  let user;
  if (exist.data.length > 0) {
    user = exist.data[0];
    await db.collection('users').doc(user._id).update({
      data: { lastLoginTime: now, lastLoginType: 'phone' }
    });
  } else {
    const r = await db.collection('users').add({
      data: {
        openid, phone,
        nickName: `用户${phone.substr(-4)}`,
        avatarUrl: '',
        isAdmin: false, isOnline: true,
        loginType: 'phone',
        createTime: now, lastLoginTime: now
      }
    });
    user = { _id: r._id, openid, isAdmin: false };
  }

  const token = generateToken({ _id: user._id, openid });
  cacheToken(token, { _id: user._id, openid, isAdmin: !!user.isAdmin }, 7 * 24 * 60 * 60 * 1000);

  return {
    token, _id: user._id, openid,
    nickName: user.nickName, avatarUrl: user.avatarUrl,
    isAdmin: !!user.isAdmin,
    phone: user.phone || phone,
    loginType: 'phone',
    isNewUser: !exist.data.length
  };
}

exports.main = async (event) => {
  const { action = 'sendCode', phone, code } = event;

  if (action === 'sendCode') {
    if (!phone) return fail('phone 必填');
    const code = await sendCode(phone);
    // 演示模式: 返回验证码;生产模式不返回
    return ok({ sent: true, demoCode: code });
  }

  if (action === 'login') {
    if (!phone || !code) return fail('phone + code 必填');
    const data = await doLogin(phone, code);
    return ok(data);
  }

  return fail('未知 action');
};
