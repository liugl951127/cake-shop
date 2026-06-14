const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return fail('获取 openid 失败', -401);

  const db = cloud.database();
  const userCol = db.collection('users');

  // 查找或创建用户
  const exist = await userCol.where({ openid }).limit(1).get();
  let user;
  if (exist.data.length > 0) {
    user = exist.data[0];
    user.lastLoginTime = Date.now();
    await userCol.doc(user._id).update({ data: { lastLoginTime: user.lastLoginTime } });
  } else {
    const res = await userCol.add({
      data: {
        openid,
        nickName: `用户${openid.substr(-4)}`,
        avatarUrl: '',
        isAdmin: false,
        createTime: Date.now(),
        lastLoginTime: Date.now()
      }
    });
    user = { _id: res._id, openid, isAdmin: false };
  }

  return ok({
    _id: user._id,
    openid,
    nickName: user.nickName,
    avatarUrl: user.avatarUrl,
    isAdmin: !!user.isAdmin
  });
};
