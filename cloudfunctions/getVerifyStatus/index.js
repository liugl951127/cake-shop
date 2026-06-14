// getVerifyStatus - 查询我的认证状态
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const user = await db.collection('users').doc(event._userId).get();
  const u = user.data || {};

  // 各认证明细
  const [realName, liveness, bank] = await Promise.all([
    db.collection('verifications').where({ _userId: event._userId, status: 1 }).orderBy('createTime', 'desc').limit(1).get(),
    db.collection('livenessRecords').where({ _userId: event._userId, passed: true }).orderBy('createTime', 'desc').limit(1).get(),
    db.collection('bankVerifications').where({ _userId: event._userId, status: 1 }).orderBy('createTime', 'desc').limit(1).get()
  ]);

  return ok({
    realName: {
      verified: !!u.realNameVerified,
      name: u.realName || '',
      time: u.realNameVerifyTime || 0
    },
    liveness: {
      verified: !!u.livenessVerified,
      time: u.livenessVerifyTime || 0,
      score: u.livenessScore || 0
    },
    bankCard: {
      verified: !!u.bankVerified,
      bank: realName.data[0] ? '' : '',  // 从 bank 集合取
      time: u.bankVerifyTime || 0,
      masked: u.defaultBankCard || ''
    },
    // 总览等级
    level: getVerifyLevel(u),
    // 可解锁能力
    unlocks: getUnlocks(u)
  });
});

function getVerifyLevel(u) {
  if (u.realNameVerified && u.livenessVerified && u.bankVerified) return 'full';
  if (u.realNameVerified && u.livenessVerified) return 'high';
  if (u.realNameVerified) return 'basic';
  return 'none';
}

function getUnlocks(u) {
  const list = [];
  if (u.realNameVerified) list.push({ name: '开具发票', icon: '🧾' });
  if (u.livenessVerified) list.push({ name: '敏感操作(退款/解绑)', icon: '🔐' });
  if (u.bankVerified) list.push({ name: '大额提现', icon: '💰' });
  if (u.realNameVerified && u.livenessVerified && u.bankVerified) {
    list.push({ name: '全部权限', icon: '✅' });
  }
  return list;
}
