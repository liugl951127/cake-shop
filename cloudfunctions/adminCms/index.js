// adminCms - CMS 后台管理(统一入口)
// action: list / add / update / delete 适用于 banner / notice / page
const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

const COLLECTIONS = ['cmsBanners', 'cmsNotices', 'cmsPages'];

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { action, type, id, data = {} } = event;
  if (!COLLECTIONS.includes(type)) throw new BizError('type 错误');
  if (!action) throw new BizError('action 必填');

  const db = cloud.database();

  if (action === 'list') {
    const res = await db.collection(type)
      .orderBy('createTime', 'desc')
      .limit(100)
      .get();
    return ok(res.data);
  }

  if (action === 'add') {
    const res = await db.collection(type).add({
      data: { ...data, createTime: Date.now(), updateTime: Date.now() }
    });
    return ok({ _id: res._id });
  }

  if (action === 'update') {
    if (!id) throw new BizError('id 必填');
    await db.collection(type).doc(id).update({
      data: { ...data, updateTime: Date.now() }
    });
    return ok();
  }

  if (action === 'delete') {
    if (!id) throw new BizError('id 必填');
    await db.collection(type).doc(id).remove();
    return ok();
  }

  throw new BizError('未知 action');
});
