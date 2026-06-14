const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { id, status } = event;
  if (!id) throw new BizError('id 必填');
  if (status === undefined) throw new BizError('status 必填');
  const db = cloud.database();
  await db.collection('orders').doc(id).update({
    data: { status: Number(status), updateTime: Date.now() }
  });
  return ok();
});
