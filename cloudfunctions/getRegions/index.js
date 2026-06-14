// getRegions - 获取省市区三级数据
const { cloud, ok } = require('../common/index.js');

exports.main = async (event) => {
  const { parent = 0 } = event;
  const db = cloud.database();
  try {
    const res = await db.collection('regions')
      .where({ parent: Number(parent), status: 1 })
      .orderBy('sort', 'asc')
      .limit(100)
      .get();
    return ok(res.data);
  } catch (e) {
    return ok([]);
  }
};
