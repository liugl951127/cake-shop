// detectFraud - 同设备 / 同 IP / 同收货人 检测
// 多个用户共享同一台设备 / IP / 收货人,就是团伙作案信号
const { cloud, ok, fail, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { deviceId = '', ip = '', address = '', phone = '' } = event;
  if (!deviceId && !ip && !address && !phone) return fail('至少给一个参数');

  const db = cloud.database();
  const _ = db.command;
  const result = { device: [], ip: [], address: [], phone: [] };

  // 同设备
  if (deviceId) {
    const r = await db.collection('users')
      .where({ lastDeviceId: deviceId })
      .field({ _id: true, openid: true, nickName: true, phone: true, level: true, blacklisted: true, lastLoginTime: true })
      .limit(20)
      .get();
    result.device = r.data;
  }

  // 同 IP(近 7 天)
  if (ip) {
    const since = Date.now() - 7 * 86400000;
    const r = await db.collection('accessLogs')
      .where({ ip, createTime: _.gt(since) })
      .field({ openid: true, createTime: true, action: true })
      .limit(50)
      .get();
    result.ip = r.data;

    // 真实账号
    const u = await db.collection('users')
      .where({ lastIp: ip })
      .field({ _id: true, nickName: true, phone: true, blacklisted: true })
      .limit(20)
      .get();
    result.ipAccounts = u.data;
  }

  // 同收货人(姓名 + 地址)
  if (address) {
    const r = await db.collection('orders')
      .where({ 'address.address': address })
      .field({ _userId: true, orderNo: true, createTime: true, totalPrice: true, status: true })
      .orderBy('createTime', 'desc')
      .limit(20)
      .get();
    result.address = r.data;
  }

  // 同手机号
  if (phone) {
    const r = await db.collection('users')
      .where({ phone })
      .field({ _id: true, nickName: true, openid: true, blacklisted: true })
      .limit(10)
      .get();
    result.phone = r.data;
  }

  // 团伙风险评估
  const deviceGroupSize = result.device.length;
  const ipGroupSize = result.ipAccounts ? result.ipAccounts.length : 0;
  const isBlacklisted = (result.device || []).some(u => u.blacklisted) ||
                        (result.ipAccounts || []).some(u => u.blacklisted);

  let gangScore = 0;
  if (deviceGroupSize >= 3) gangScore += 30;
  if (deviceGroupSize >= 5) gangScore += 20;
  if (ipGroupSize >= 5) gangScore += 15;
  if (isBlacklisted) gangScore += 50;
  gangScore = Math.min(100, gangScore);

  return ok({
    ...result,
    gangScore,
    gangLevel: gangScore >= 50 ? 'high' : gangScore >= 30 ? 'medium' : 'low',
    suspectCount: deviceGroupSize + ipGroupSize,
    hasBlacklisted: isBlacklisted
  });
});
