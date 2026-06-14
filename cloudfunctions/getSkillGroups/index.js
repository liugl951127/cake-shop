// getSkillGroups - 获取技能组(供转接选择)
// 技能组: 售前/售后/财务/投诉/VIP/技术 等
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const res = await db.collection('skillGroups')
    .where({ enabled: true })
    .orderBy('priority', 'asc')
    .get();

  // 计算每个组的当前可用坐席数
  const list = await Promise.all(res.data.map(async (g) => {
    const agents = await db.collection('agents')
      .where({ skillGroups: db.command.elemMatch({ $eq: g._id }), online: true, busy: false, acceptStatus: 1 })
      .count();
    const total = await db.collection('agents')
      .where({ skillGroups: db.command.elemMatch({ $eq: g._id }), online: true })
      .count();
    return { ...g, available: agents.total, online: total.total };
  }));

  return ok(list);
});
