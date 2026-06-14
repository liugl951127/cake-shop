// getMemberInfo - 会员信息(等级/成长值/积分/签到)
const { cloud, ok, auth } = require('../common/index.js');
const { getLevel, getNextLevel, LEVELS, SIGNIN_POINTS } = require('../common/member.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const user = await db.collection('users').doc(event._userId).get();
  if (!user.data) return ok({});
  const u = user.data;

  const exp = u.exp || 0;
  const points = u.points || 0;
  const level = getLevel(exp);
  const next = getNextLevel(exp);

  // 今日是否已签到
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const signin = await db.collection('signins')
    .where({ _openid: event._openid, createTime: db.command.gte(todayStart) })
    .limit(1)
    .get();

  // 连续签到天数
  const signs = await db.collection('signins')
    .where({ _openid: event._openid })
    .orderBy('createTime', 'desc')
    .limit(30)
    .get();
  let streak = 0;
  let lastDate = null;
  for (const s of signs.data) {
    const d = new Date(s.createTime);
    d.setHours(0, 0, 0, 0);
    if (lastDate === null) {
      lastDate = d.getTime();
      streak = 1;
    } else {
      const expected = lastDate - 86400000;
      if (d.getTime() === expected) {
        streak++;
        lastDate = d.getTime();
      } else break;
    }
  }

  // 积分流水
  const logs = await db.collection('pointLogs')
    .where({ _openid: event._openid })
    .orderBy('createTime', 'desc')
    .limit(20)
    .get();

  return ok({
    level,
    next,
    exp,
    points,
    signedInToday: signin.data.length > 0,
    signinStreak: streak,
    signinPoints: SIGNIN_POINTS,
    growthPercent: next ? Math.min(100, Math.floor((exp - level.min) / (next.min - level.min) * 100)) : 100,
    levelList: LEVELS,
    pointLogs: logs.data.map(l => ({
      ...l,
      createTime: formatTime(new Date(l.createTime), 'MM-DD HH:mm')
    }))
  });
});
