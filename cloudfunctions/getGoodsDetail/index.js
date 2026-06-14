const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { id } = event;
  if (!id) return fail('id 必填');
  const db = cloud.database();
  try {
    const res = await db.collection('goods').doc(id).get();
    // 累加浏览量
    await db.collection('goods').doc(id).update({
      data: { viewCount: db.command.inc(1) }
    }).catch(() => {});
    return ok(res.data);
  } catch (e) {
    return fail('商品不存在', -404);
  }
};
