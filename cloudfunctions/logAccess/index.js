// logAccess - 客户端访问日志(用于反欺诈)
// 小程序启动 / 关键操作时调用
// 字段: openid + 设备 + IP + 行为 + 地理位置
const { cloud, ok, auth } = require('../common/index.js');

const wxContext = cloud.getWXContext();

exports.main = auth(async (event) => {
  const { action = 'launch', deviceId = '', platform = '', version = '', extra = {} } = event;
  const db = cloud.database();

  // 用 wx 上下文拿 clientIP
  const ip = wxContext.CLIENTIP || '';
  // 客户端给的位置(可选)
  const { lat = 0, lng = 0 } = extra;

  // 写访问日志
  await db.collection('accessLogs').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      action,
      deviceId,
      platform,
      version,
      ip,
      lat, lng,
      extra,
      createTime: Date.now()
    }
  });

  // 同步更新用户的 lastDeviceId / lastIp(反欺诈用)
  if (deviceId || ip) {
    const update = { lastVisitTime: Date.now() };
    if (deviceId) update.lastDeviceId = deviceId;
    if (ip) update.lastIp = ip;
    if (platform) update.lastPlatform = platform;
    if (lat) update.lastLat = lat;
    if (lng) update.lastLng = lng;
    await db.collection('users').doc(event._userId).update({ data: update }).catch(() => {});
  }

  return ok({ logged: true });
});
