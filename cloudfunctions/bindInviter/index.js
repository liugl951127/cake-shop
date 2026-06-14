// bindInviter - 绑定邀请关系
// 场景: A 分享链接/二维码给 B,B 通过该入口进入小程序,登录时绑定 A 为邀请人
// 奖励:
//   - B 完成首单,给 A 50 积分 + 一张优惠券
//   - B 完成首单,给 B 自己 50 积分
const { cloud, ok, BizError, auth } = require('../common/index.js');

const FIRST_ORDER_REWARD = {
  inviter: { points: 50, coupon: '新人 50 元大礼包' },
  invitee: { points: 50 }
};

exports.main = auth(async (event) => {
  const { inviterCode = '' } = event;
  if (!inviterCode) return ok({ bound: false, reason: 'no_code' });

  const db = cloud.database();
  const _ = db.command;

  // 查邀请人
  const inviterRes = await db.collection('users').where({ inviteCode: inviterCode }).limit(1).get();
  if (!inviterRes.data[0]) return ok({ bound: false, reason: 'invalid_code' });
  const inviter = inviterRes.data[0];

  // 不能邀请自己
  if (inviter.openid === event._openid) return ok({ bound: false, reason: 'self' });

  // 当前用户
  const me = await db.collection('users').doc(event._userId).get();
  if (me.data.inviterOpenid) return ok({ bound: false, reason: 'already_binded' });
  if (me.data.inviterCode && me.data.inviterCode === inviterCode) return ok({ bound: false, reason: 'already_binded' });

  // 绑定
  await db.collection('users').doc(event._userId).update({
    data: {
      inviterOpenid: inviter.openid,
      inviterCode,
      inviterBindTime: Date.now(),
      updateTime: Date.now()
    }
  });

  return ok({ bound: true, inviterName: inviter.nickName });
});
