// getCmsNotices - 公告列表
const { cloud, ok } = require('../common/index.js');

exports.main = async (event) => {
  const { page = 1, pageSize = 5 } = event;
  const db = cloud.database();
  const res = await db.collection('cmsNotices')
    .where({ status: 1 })
    .orderBy('top', 'desc')
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok(res.data);
};
