// getGroupInfo - 团详情
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { groupId } = event;
  if (!groupId) return fail('groupId 必填');
  const db = cloud.database();
  const res = await db.collection('groups').where({ groupId }).limit(1).get();
  if (!res.data[0]) return fail('团不存在', -404);
  const g = res.data[0];

  // 倒计时
  const now = Date.now();
  let remainMs = g.expireTime - now;
  if (remainMs < 0) remainMs = 0;
  if (g.status === 1 && remainMs === 0) {
    // 自动失败(查询时)
    g.status = 3;
  }
  return ok({ ...g, remainMs, currentTime: now });
};
