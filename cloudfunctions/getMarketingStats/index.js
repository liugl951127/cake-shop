// getMarketingStats - 营销规则统计
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const last7 = now - 7 * 86400000;

  // 近 7 天的营销日志
  const logs = await db.collection('marketingLogs')
    .where({ createTime: _.gte(last7) })
    .orderBy('createTime', 'desc')
    .limit(500)
    .get();

  // 按规则聚合
  const stats = {};
  for (const l of logs.data) {
    const code = l.ruleCode;
    if (!stats[code]) stats[code] = { code, name: l.ruleName, totalSent: 0, totalConverted: 0, lastRun: 0 };
    stats[code].totalSent += (l.result && l.result.sent) || 0;
    stats[code].lastRun = Math.max(stats[code].lastRun, l.createTime);
  }

  // 转化(收消息后 7 天内下单)
  for (const k of Object.keys(stats)) {
    const couponRes = await db.collection('couponUsers')
      .where({ from: k, status: 1, useTime: _.gte(last7) })
      .count();
    stats[k].totalConverted = couponRes.total;
    stats[k].conversionRate = stats[k].totalSent > 0
      ? Number((stats[k].totalConverted / stats[k].totalSent * 100).toFixed(1))
      : 0;
  }

  // 最近一条
  const lastLogs = logs.data.slice(0, 5);

  return ok({ stats: Object.values(stats), lastLogs });
});
