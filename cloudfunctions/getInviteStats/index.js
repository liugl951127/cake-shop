// getInviteStats - 我的邀请战绩
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const _ = db.command;

  // 我邀请的且完成首单的人数
  const invitees = await db.collection('users')
    .where({ inviterOpenid: event._openid, firstOrderRewarded: true })
    .count();
  // 累计被邀请但未必成单的
  const allInvitees = await db.collection('users')
    .where({ inviterOpenid: event._openid })
    .count();
  // 邀请获得的积分
  const pointLogs = await db.collection('pointLogs')
    .where({ _openid: event._openid, type: 'invite' })
    .get();
  const invitePoints = pointLogs.data.reduce((s, p) => s + (p.delta || 0), 0);

  return ok({
    inviteCount: allInvitees.total,
    firstOrderCount: invitees.total,
    invitePoints
  });
});
