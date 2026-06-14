// getCmsPage - 获取 CMS 富文本页面(关于/协议/隐私/帮助)
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { slug } = event;
  if (!slug) return fail('slug 必填');
  const db = cloud.database();
  const res = await db.collection('cmsPages')
    .where({ slug, status: 1 })
    .limit(1)
    .get();
  if (!res.data[0]) return fail('页面不存在', -404);
  return ok(res.data[0]);
};
