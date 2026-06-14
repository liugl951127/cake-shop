// signIn - 每日签到
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { SIGNIN_POINTS } = require('../common/member.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const _ = db.command;

  // 今日已签到?
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const exist = await db.collection('signins')
    .where({ _openid: event._openid, createTime: _.gte(todayStart) })
    .limit(1)
    .get();
  if (exist.data.length > 0) throw new BizError('今日已签到');

  // 写签到记录
  await db.collection('signins').add({
    data: { _openid: event._openid, points: SIGNIN_POINTS, createTime: Date.now() }
  });

  // 累加积分
  const user = await db.collection('users').doc(event._userId).get();
  const newPoints = (user.data.points || 0) + SIGNIN_POINTS;
  await db.collection('users').doc(event._userId).update({
    data: { points: newPoints, updateTime: Date.now() }
  });

  // 写积分流水
  await db.collection('pointLogs').add({
    data: {
      _openid: event._openid,
      type: 'signin',
      delta: SIGNIN_POINTS,
      balance: newPoints,
      remark: '每日签到奖励',
      createTime: Date.now()
    }
  });

  return ok({ points: SIGNIN_POINTS, total: newPoints });
});
