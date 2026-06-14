const { cloud, ok, fail } = require('../common/index.js');
const { generateToken, cacheToken } = require('../common/token.js');

/**
 * 登录主入口
 * 入参: { code, nickName, avatarUrl, encryptedData?, iv? }
 * 返回: { token, openid, unionid?, nickName, avatarUrl, isAdmin }
 */
exports.main = async (event) => {
  const { code, nickName = '', avatarUrl = '' } = event;
  if (!code) return fail('code 必填');

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const unionid = wxContext.UNIONID || '';

  if (!openid) return fail('获取 openid 失败', -401);

  const db = cloud.database();
  const userCol = db.collection('users');

  // 查找或创建用户
  const exist = await userCol.where({ openid }).limit(1).get();
  const now = Date.now();

  let user;
  if (exist.data.length > 0) {
    user = exist.data[0];
    const update = { lastLoginTime: now };
    if (nickName) update.nickName = nickName;
    if (avatarUrl) update.avatarUrl = avatarUrl;
    await userCol.doc(user._id).update({ data: update });
    user = { ...user, ...update };
  } else {
    const res = await userCol.add({
      data: {
        openid,
        unionid,
        nickName: nickName || `用户${openid.substr(-4)}`,
        avatarUrl: avatarUrl || '',
        isAdmin: false,
        phone: '',
        inviteCode: generateInviteCode(),
        inviterCode: inviterCode || '',
        inviterOpenid: '',
        inviterBindTime: 0,
        firstOrderRewarded: false,
        createTime: now,
        lastLoginTime: now
      }
    });
    user = { _id: res._id, openid, unionid, nickName, avatarUrl, isAdmin: false };
  }

  // 生成 token(7 天免登录)
  const token = generateToken({ _id: user._id, openid });
  cacheToken(token, {
    _id: user._id,
    openid,
    isAdmin: !!user.isAdmin
  }, 7 * 24 * 60 * 60 * 1000);

  return ok({
    token,
    openid,
    unionid,
    _id: user._id,
    nickName: user.nickName,
    avatarUrl: user.avatarUrl,
    isAdmin: !!user.isAdmin,
    inviteCode: user.inviteCode,
    phone: user.phone || ''
  });
};

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
