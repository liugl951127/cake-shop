const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  try {
    const res = await db.collection('categories')
      .where({ status: _.neq(0) })
      .orderBy('sort', 'asc')
      .get();
    return ok(res.data);
  } catch (e) {
    // collection 不存在时返回空
    return ok([]);
  }
};
