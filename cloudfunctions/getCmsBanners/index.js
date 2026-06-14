// getCmsBanners - 获取首页 Banner(优先取 cmsBanners, 兼容老 banners 集合)
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  try {
    // 优先 cmsBanners
    const res = await db.collection('cmsBanners')
      .where({ status: 1 })
      .orderBy('sort', 'asc')
      .limit(10)
      .get();
    if (res.data.length > 0) return ok(res.data);
  } catch (e) {}
  // fallback 老 banners
  try {
    const res = await db.collection('banners')
      .where({ status: 1 })
      .orderBy('sort', 'asc')
      .limit(10)
      .get();
    return ok(res.data);
  } catch (e) {
    return ok([]);
  }
};
