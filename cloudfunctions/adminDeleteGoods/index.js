const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  // 软删除:status = 0
  await db.collection('goods').doc(id).update({
    data: { status: 0, updateTime: Date.now() }
  });
  return ok();
});
