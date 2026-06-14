const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { page = 1, pageSize = 20, category = '', keyword = '', recommend = false } = event;
  const db = cloud.database();
  const _ = db.command;

  const where = { status: 1 };
  if (category) where.category = category;
  if (keyword) where.name = db.RegExp({ regexp: keyword, options: 'i' });
  if (recommend) where.recommend = true;

  try {
    const res = await db.collection('goods')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    return ok(res.data);
  } catch (e) {
    return ok([]);
  }
};
