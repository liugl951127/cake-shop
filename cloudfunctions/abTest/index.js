// abTest - A/B 测试框架
// action: assign / report / stats
const { cloud, ok, auth } = require('../common/index.js');

function hashToBucket(key, salt) {
  let h = 0;
  const s = key + (salt || '');
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return h % 100;
}

exports.main = auth(async (event) => {
  const { action = 'assign' } = event;
  switch (action) {
    case 'assign': return assign(event);
    case 'report': return report(event);
    case 'stats': return stats(event);
    case 'create': return createExperiment(event);
    default: return ok({});
  }
});

// 分桶 + 返回实验配置
async function assign(event) {
  const { expKey = 'default' } = event;
  const db = cloud.database();
  const exp = await db.collection('abExperiments').where({ key: expKey, status: 'running' }).limit(1).get();
  if (!exp.data[0]) return ok({ expKey, bucket: 0, variant: 'control' });

  const e = exp.data[0];
  const bucket = hashToBucket(event._userId || event._openid, expKey);

  // 找到对应变体
  let cumulative = 0;
  let variant = 'control';
  for (const v of e.variants) {
    cumulative += v.weight;
    if (bucket < cumulative) { variant = v.name; break; }
  }

  // 记曝光
  await db.collection('abEvents').add({
    data: {
      expKey, variant, event: 'exposure',
      _userId: event._userId, _openid: event._openid,
      createTime: Date.now()
    }
  }).catch(() => {});

  return ok({ expKey, bucket, variant, config: e.variants.find(v => v.name === variant) || {} });
}

// 上报转化
async function report(event) {
  const { expKey, variant, event: eventName = 'convert', value = 1 } = event;
  await cloud.database().collection('abEvents').add({
    data: {
      expKey, variant, event: eventName, value,
      _userId: event._userId, _openid: event._openid,
      createTime: Date.now()
    }
  }).catch(() => {});
  return ok({ reported: true });
}

// 看效果
async function stats(event) {
  const { expKey = '' } = event;
  const db = cloud.database();
  const where = expKey ? { expKey } : {};
  const res = await db.collection('abEvents').where(where).limit(5000).get();

  // 按变体聚合
  const groups = {};
  for (const e of res.data) {
    const k = e.variant || 'control';
    if (!groups[k]) groups[k] = { variant: k, exposure: 0, convert: 0, total: 0, count: 0 };
    if (e.event === 'exposure') groups[k].exposure++;
    if (e.event === 'convert') { groups[k].convert++; groups[k].total += e.value || 0; }
    groups[k].count++;
  }

  const result = Object.values(groups).map(g => ({
    ...g,
    conversionRate: g.exposure > 0 ? Number((g.convert / g.exposure * 100).toFixed(2)) : 0,
    avgValue: g.convert > 0 ? Number((g.total / g.convert).toFixed(2)) : 0
  }));

  return ok({ expKey, variants: result });
}

async function createExperiment(event) {
  const { key, name, variants = [] } = event;
  if (!key || !variants.length) return ok({});
  // 变体格式: [{ name: 'A', weight: 50, config: {} }, { name: 'B', weight: 50, config: {} }]
  const total = variants.reduce((s, v) => s + (v.weight || 0), 0);
  if (total !== 100) return ok({ error: '权重需 = 100' });

  await cloud.database().collection('abExperiments').add({
    data: {
      key, name, variants, status: 'running',
      createTime: Date.now()
    }
  }).catch(() => {});
  return ok({ created: true });
}
