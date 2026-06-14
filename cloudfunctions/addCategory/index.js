const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { name, sort, icon, status } = event;
  if (!name) throw new BizError('名称必填');
  const db = cloud.database();
  const res = await db.collection('categories').add({
    data: {
      name,
      sort: Number(sort) || 0,
      icon: icon || '',
      status: status !== undefined ? Number(status) : 1,
      createTime: Date.now()
    }
  });
  return ok({ _id: res._id });
});
