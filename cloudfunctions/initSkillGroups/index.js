// initSkillGroups - 初始化技能组数据
const { cloud, ok } = require('../common/index.js');

const GROUPS = [
  { name: '售前咨询', icon: '🛒', color: '#e3f2fd', description: '商品咨询、下单协助', priority: 1 },
  { name: '售后服务', icon: '🛠️', color: '#fff3e0', description: '订单问题、退换货', priority: 2 },
  { name: '财务', icon: '💰', color: '#e8f5e9', description: '退款查询、发票', priority: 3 },
  { name: 'VIP 客户', icon: '👑', color: '#fce4ec', description: '钻石会员专属', priority: 4 },
  { name: '投诉建议', icon: '⚠️', color: '#ffebee', description: '客户投诉处理', priority: 5 },
  { name: '定制服务', icon: '🎂', color: '#f3e5f5', description: '蛋糕定制、企业团采', priority: 6 }
];

exports.main = async (event) => {
  const db = cloud.database();
  const existing = await db.collection('skillGroups').limit(1).get();
  if (existing.data.length > 0) return ok({ alreadyInit: true });

  for (const g of GROUPS) {
    await db.collection('skillGroups').add({
      data: { ...g, enabled: true, createTime: Date.now() }
    });
  }
  return ok({ initCount: GROUPS.length });
};
