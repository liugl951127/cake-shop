// lowcode - 低代码后台
// 三大能力:
//   1. 页面搭建(拖拽组件: 文本/图片/按钮/列表/表单/统计卡片)
//   2. 报表定义(SQL/聚合: COUNT/SUM/AVG/GROUP BY 时间维度)
//   3. 活动模板(满减/折扣/拼团/秒杀 模板化配置)
// action:
//   页面: savePage / getPage / listPages / publishPage
//   报表: saveReport / runReport / listReports
//   活动: saveCampaign / listCampaigns
const { cloud, ok, fail, auth } = require('../common/index.js');

// 组件库
const COMPONENTS = {
  text: { name: '文本', icon: '📝', props: { content: '请输入文本', color: '#333', size: 28, align: 'left' } },
  image: { name: '图片', icon: '🖼️', props: { src: '', width: 690, height: 300, mode: 'aspectFill' } },
  button: { name: '按钮', icon: '🔘', props: { text: '点击', color: '#fff', bg: '#ff5722', action: 'link', url: '' } },
  list: { name: '商品列表', icon: '📋', props: { source: 'goods', count: 6, columns: 2, fields: ['name', 'price', 'image'] } },
  form: { name: '表单', icon: '📝', props: { fields: [], submitAction: 'collectForm' } },
  stats: { name: '统计卡片', icon: '📊', props: { source: 'revenue', range: 'today', format: 'currency' } },
  banner: { name: '轮播图', icon: '🎠', props: { images: [], interval: 3000, autoplay: true } },
  richText: { name: '富文本', icon: '📄', props: { content: '' } }
};

exports.main = auth(async (event) => {
  const { action = 'listPages' } = event;
  switch (action) {
    case 'components': return ok(COMPONENTS);
    case 'savePage': return savePage(event);
    case 'getPage': return getPage(event);
    case 'listPages': return listPages(event);
    case 'deletePage': return deletePage(event);
    case 'publishPage': return publishPage(event);
    case 'saveReport': return saveReport(event);
    case 'runReport': return runReport(event);
    case 'listReports': return listReports(event);
    case 'saveCampaign': return saveCampaign(event);
    case 'listCampaigns': return listCampaigns(event);
    default: return fail('未知 action');
  }
});

async function savePage(event) {
  const { id, name = '新页面', slug = '', components = [], publish = false } = event;
  if (!Array.isArray(components)) return fail('components 必填');
  const db = cloud.database();
  const now = Date.now();
  const doc = {
    name, slug, components,
    status: publish ? 1 : 0,
    updateTime: now
  };
  if (id) {
    await db.collection('lowcodePages').doc(id).update({ data: doc });
    return ok({ id, updated: true });
  } else {
    doc.createTime = now;
    doc.createBy = event._userId;
    const r = await db.collection('lowcodePages').add({ data: doc });
    return ok({ id: r._id });
  }
}

async function getPage(event) {
  const { id = '', slug = '' } = event;
  const db = cloud.database();
  if (id) {
    const r = await db.collection('lowcodePages').doc(id).get();
    return ok(r.data);
  }
  if (slug) {
    const r = await db.collection('lowcodePages').where({ slug, status: 1 }).limit(1).get();
    return ok(r.data[0] || null);
  }
  return ok(null);
}

async function listPages(event) {
  const db = cloud.database();
  const res = await db.collection('lowcodePages')
    .orderBy('updateTime', 'desc')
    .limit(50)
    .get();
  return ok(res.data);
}

async function deletePage(event) {
  const { id } = event;
  if (!id) return fail('id 必填');
  await cloud.database().collection('lowcodePages').doc(id).remove();
  return ok({ deleted: true });
}

async function publishPage(event) {
  const { id } = event;
  if (!id) return fail('id 必填');
  await cloud.database().collection('lowcodePages').doc(id).update({ data: { status: 1, publishTime: Date.now() } });
  return ok({ published: true });
}

// 报表
async function saveReport(event) {
  const { id, name, source, metric, dimension, range, filters = [] } = event;
  if (!name || !source || !metric) return fail('参数必填');
  const db = cloud.database();
  const now = Date.now();
  const doc = { name, source, metric, dimension, range, filters, updateTime: now };
  if (id) {
    await db.collection('lowcodeReports').doc(id).update({ data: doc });
    return ok({ id, updated: true });
  }
  doc.createTime = now;
  const r = await db.collection('lowcodeReports').add({ data: doc });
  return ok({ id: r._id });
}

async function runReport(event) {
  const { id, params = {} } = event;
  if (!id) return fail('id 必填');
  const db = cloud.database();
  const r = await db.collection('lowcodeReports').doc(id).get();
  if (!r.data) return fail('报表不存在');
  const cfg = r.data;
  // 简化:对 orders 集合做 group by
  const _ = db.command;
  let where = { status: _.gte(1) };
  if (cfg.range === 'today') where.createTime = _.gte(new Date(new Date().toDateString()).getTime());
  else if (cfg.range === '7d') where.createTime = _.gte(Date.now() - 7 * 86400000);
  else if (cfg.range === '30d') where.createTime = _.gte(Date.now() - 30 * 86400000);

  const data = await db.collection('orders').where(where).limit(2000).get();
  // 按 dimension 聚合
  const groups = {};
  for (const o of data.data) {
    let k = 'all';
    if (cfg.dimension === 'date') {
      k = new Date(o.createTime).toISOString().slice(0, 10);
    } else if (cfg.dimension === 'shopId') {
      k = o.shopId || 'default';
    } else if (cfg.dimension === 'category') {
      k = (o.goods && o.goods[0] && o.goods[0].categoryId) || 'default';
    }
    if (!groups[k]) groups[k] = { key: k, value: 0, count: 0 };
    if (cfg.metric === 'revenue') groups[k].value += o.totalPrice || 0;
    else if (cfg.metric === 'count') groups[k].value++;
    else if (cfg.metric === 'avgOrder' && groups[k].count === 0) groups[k].value = o.totalPrice;
    groups[k].count++;
  }
  return ok({ list: Object.values(groups).map(g => ({ ...g, value: Number(g.value.toFixed(2)) })) });
}

async function listReports(event) {
  const db = cloud.database();
  const res = await db.collection('lowcodeReports').orderBy('createTime', 'desc').limit(50).get();
  return ok(res.data);
}

// 活动模板
async function saveCampaign(event) {
  const { id, name, type, config } = event;
  if (!name || !type) return fail('参数必填');
  const db = cloud.database();
  const now = Date.now();
  const doc = { name, type, config, updateTime: now };
  if (id) {
    await db.collection('lowcodeCampaigns').doc(id).update({ data: doc });
    return ok({ id });
  }
  doc.createTime = now;
  doc.createBy = event._userId;
  doc.status = 1;
  const r = await db.collection('lowcodeCampaigns').add({ data: doc });
  return ok({ id: r._id });
}

async function listCampaigns(event) {
  const db = cloud.database();
  const res = await db.collection('lowcodeCampaigns').orderBy('createTime', 'desc').limit(50).get();
  return ok(res.data);
}
