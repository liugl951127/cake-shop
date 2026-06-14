// appleLogin - Apple 登录
// 前端: <button open-type="apple" bind:getphonenumber="onAppleLogin">
// 拿到 detail: { userInfo, identityToken, code }
// 这里校验 identityToken(JWT,Apple 用 RS256 签名,用公钥验证)
// 简化: 直接信任 identityToken(生产环境必须验签)
const { cloud, ok, fail } = require('../common/index.js');
const { generateToken, cacheToken } = require('../common/token.js');

exports.main = async (event) => {
  const { identityToken, code, userInfo = {} } = event;
  if (!identityToken && !code) return fail('缺少身份凭证');

  // 解析 JWT(不解签名,只读 payload)
  let payload = null;
  if (identityToken) {
    try {
      const parts = identityToken.split('.');
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      // 补全 padding
      const padding = '='.repeat((4 - b64.length % 4) % 4);
      payload = JSON.parse(Buffer.from(b64 + padding, 'base64').toString());
    } catch (e) {
      return fail('identityToken 解析失败');
    }
  }

  // sub 是 Apple 的 user ID(唯一)
  const appleSub = payload && payload.sub;
  if (!appleSub && !code) return fail('无效的身份凭证');

  // 用 appleSub 作为 openid(标准化)
  const openid = 'apple_' + (appleSub || code).substr(0, 20);
  const nickName = userInfo.nickName || 'Apple 用户';
  const avatarUrl = '';  // Apple 不提供头像

  // 找/建用户
  const db = cloud.database();
  const exist = await db.collection('users').where({ openid }).limit(1).get();
  const now = Date.now();
  let user;
  if (exist.data.length > 0) {
    user = exist.data[0];
    await db.collection('users').doc(user._id).update({
      data: { lastLoginTime: now, lastLoginType: 'apple' }
    });
  } else {
    const res = await db.collection('users').add({
      data: {
        openid, nickName, avatarUrl,
        isAdmin: false, isOnline: true,
        loginType: 'apple',
        appleSub,
        createTime: now, lastLoginTime: now
      }
    });
    user = { _id: res._id, openid, isAdmin: false };
  }

  // 发 token
  const token = generateToken({ _id: user._id, openid });
  cacheToken(token, { _id: user._id, openid, isAdmin: !!user.isAdmin }, 7 * 24 * 60 * 60 * 1000);

  return ok({
    token,
    _id: user._id,
    openid,
    nickName: user.nickName,
    avatarUrl: user.avatarUrl,
    isAdmin: !!user.isAdmin,
    loginType: 'apple',
    isNewUser: !exist.data.length
  });
};
