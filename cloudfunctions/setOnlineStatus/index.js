// setOnlineStatus - 客服上下线
const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { isOnline = true } = event;
  const db = cloud.database();
  await db.collection('users').doc(event._userId).update({
    data: { isOnline: !!isOnline, updateTime: Date.now() }
  });
  return ok({ isOnline: !!isOnline });
});
