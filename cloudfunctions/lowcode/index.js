// lowcode - 低代码 + 模板化
// 6 大能力:
//   1. 页面搭建(8 组件)
//   2. 报表定义(4 维聚合)
//   3. 活动模板(4 类活动,模板化配置)
//   4. 表单生成器(动态字段、校验规则)
//   5. 业务规则(可配置条件 + 动作)
//   6. 模板市场(复制现成方案)
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

// 组件库
const COMPONENTS = {
  text: { name: '文本', icon: '📝', category: 'base' },
  image: { name: '图片', icon: '🖼️', category: 'base' },
  button: { name: '按钮', icon: '🔘', category: 'base' },
  list: { name: '商品列表', icon: '📋', category: 'data' },
  form: { name: '表单', icon: '📝', category: 'form' },
  stats: { name: '统计卡片', icon: '📊', category: 'data' },
  banner: { name: '轮播图', icon: '🎠', category: 'base' },
  richText: { name: '富文本', icon: '📄', category: 'base' },
  card: { name: '卡片', icon: '🃏', category: 'base' },
  tabs: { name: '标签页', icon: '📑', category: 'nav' },
  search: { name: '搜索框', icon: '🔍', category: 'base' },
  map: { name: '地图', icon: '🗺️', category: 'data' },
  countdown: { name: '倒计时', icon: '⏰', category: 'base' },
  share: { name: '分享', icon: '🔗', category: 'base' },
  coupon: { name: '优惠券', icon: '🎟️', category: 'promo' },
  goods: { name: '商品卡', icon: '🎂', category: 'data' }
};

// 活动模板
const CAMPAIGN_TEMPLATES = {
  full_reduce: {
    name: '满减', icon: '💰',
    fields: [
      { key: 'name', label: '活动名', type: 'text', required: true },
      { key: 'tiers', label: '档位', type: 'array',
        itemFields: [
          { key: 'minAmount', label: '满', type: 'number' },
          { key: 'reduceAmount', label: '减', type: 'number' }
        ]
      },
      { key: 'startTime', label: '开始', type: 'datetime' },
      { key: 'endTime', label: '结束', type: 'datetime' },
      { key: 'limitPerUser', label: '每人限', type: 'number', default: 1 }
    ]
  },
  discount: {
    name: '折扣', icon: '🏷️',
    fields: [
      { key: 'name', label: '活动名', type: 'text', required: true },
      { key: 'rate', label: '折扣(0-1)', type: 'number', min: 0.1, max: 1, default: 0.9 },
      { key: 'goodsIds', label: '参与商品', type: 'array', itemType: 'goods' }
    ]
  },
  seckill: {
    name: '秒杀', icon: '⚡',
    fields: [
      { key: 'name', label: '活动名', type: 'text', required: true },
      { key: 'goodsId', label: '商品', type: 'goods' },
      { key: 'seckillPrice', label: '秒杀价', type: 'number' },
      { key: 'totalStock', label: '总库存', type: 'number' },
      { key: 'perUserLimit', label: '每人限', type: 'number', default: 1 }
    ]
  },
  group: {
    name: '拼团', icon: '👥',
    fields: [
      { key: 'name', label: '活动名', type: 'text', required: true },
      { key: 'goodsId', label: '商品', type: 'goods' },
      { key: 'groupPrice', label: '拼团价', type: 'number' },
      { key: 'groupSize', label: '成团人数', type: 'number', default: 3 },
      { key: 'duration', label: '有效时长(小时)', type: 'number', default: 24 }
    ]
  },
  lucky_bag: {
    name: '拼手气福袋', icon: '🎁',
    fields: [
      { key: 'name', label: '活动名', type: 'text', required: true },
      { key: 'price', label: '价格', type: 'number' },
      { key: 'prizes', label: '奖品', type: 'array',
        itemFields: [
          { key: 'name', label: '名称', type: 'text' },
          { key: 'weight', label: '权重', type: 'number' },
          { key: 'value', label: '价值', type: 'number' }
        ]
      }
    ]
  }
};

// 表单字段类型
const FORM_FIELD_TYPES = {
  text: { name: '文本', icon: '📝' },
  number: { name: '数字', icon: '🔢' },
  textarea: { name: '多行文本', icon: '📄' },
  date: { name: '日期', icon: '📅' },
  datetime: { name: '日期时间', icon: '⏰' },
  select: { name: '下拉', icon: '📋' },
  radio: { name: '单选', icon: '⚪' },
  checkbox: { name: '多选', icon: '☑️' },
  switch: { name: '开关', icon: '🔘' },
  upload: { name: '上传', icon: '📎' },
  goods: { name: '关联商品', icon: '🎂' },
  user: { name: '关联用户', icon: '👤' }
};

// 模板市场(预置方案)
const MARKET_TEMPLATES = [
  {
    id: 'birthday_gift',
    name: '生日礼遇活动',
    icon: '🎂', category: 'campaign',
    description: '提前 7 天通知 + 自动发券 + 推送',
    data: { type: 'full_reduce', name: '生日礼遇', tiers: [{ minAmount: 100, reduceAmount: 20 }] }
  },
  {
    id: 'flash_sale',
    name: '限时秒杀',
    icon: '⚡', category: 'campaign',
    description: '倒计时 + 库存预警 + 排队',
    data: { type: 'seckill', name: '限时秒杀' }
  },
  {
    id: 'group_buy_3',
    name: '3 人成团',
    icon: '👥', category: 'campaign',
    description: '老带新裂变',
    data: { type: 'group', name: '3 人成团', groupSize: 3 }
  },
  {
    id: 'invite_reward',
    name: '邀请奖励',
    icon: '💌', category: 'rule',
    description: '双向积分 + 优惠券',
    data: { type: 'rule', trigger: 'invite', reward: { inviter: 100, invitee: 50 } }
  },
  {
    id: 'vip_price',
    name: '会员价',
    icon: '👑', category: 'rule',
    description: '不同等级不同折扣',
    data: { type: 'rule', trigger: 'vip_level', levels: { bronze: 0.95, silver: 0.9, gold: 0.85, diamond: 0.8 } }
  },
  {
    id: 'high_value_warning',
    name: '高价值客户关怀',
    icon: '⭐', category: 'rule',
    description: '消费 ≥ 1000 自动 VIP 升级',
    data: { type: 'rule', trigger: 'order_paid', condition: 'amount >= 1000', action: 'upgrade_vip' }
  },
  {
    id: 'complaint_priority',
    name: '投诉优先处理',
    icon: '⚠️', category: 'rule',
    description: '投诉类订单加急派单',
    data: { type: 'rule', trigger: 'order_create', condition: 'type == complaint', action: 'urgent_dispatch' }
  },
  {
    id: 'returning_user',
    name: '回头客奖励',
    icon: '🔄', category: 'rule',
    description: '第 2 单起每单 9 折',
    data: { type: 'rule', trigger: 'order_paid', condition: 'orderCount >= 2', action: 'discount_10' }
  }
];

exports.main = auth(async (event) => {
  const { action = 'listPages' } = event;
  switch (action) {
    // 组件库
    case 'components': return ok(COMPONENTS);
    case 'formTypes': return ok(FORM_FIELD_TYPES);

    // 页面
    case 'savePage': return savePage(event);
    case 'getPage': return getPage(event);
    case 'listPages': return listPages(event);
    case 'deletePage': return deletePage(event);
    case 'publishPage': return publishPage(event);

    // 报表
    case 'saveReport': return saveReport(event);
    case 'runReport': return runReport(event);
    case 'listReports': return listReports(event);

    // 活动
    case 'campaignTemplates': return ok(CAMPAIGN_TEMPLATES);
    case 'saveCampaign': return saveCampaign(event);
    case 'listCampaigns': return listCampaigns(event);
    case 'applyCampaignTemplate': return applyCampaignTemplate(event);

    // 表单生成器
    case 'saveForm': return saveForm(event);
    case 'listForms': return listForms(event);
    case 'getForm': return getForm(event);
    case 'submitForm': return submitForm(event);
    case 'listSubmissions': return listSubmissions(event);

    // 业务规则引擎
    case 'saveRule': return saveRule(event);
    case 'listRules': return listRules(event);
    case 'toggleRule': return toggleRule(event);
    case 'deleteRule': return deleteRule(event);
    case 'testRule': return testRule(event);

    // 模板市场
    case 'marketTemplates': return ok(MARKET_TEMPLATES);
    case 'applyTemplate': return applyTemplate(event);

    default: return fail('未知 action');
  }
});

// ============== 页面 ==============
async function savePage(event) {
  const { id, name = '新页面', slug = '', components = [], publish = false } = event;
  if (!Array.isArray(components)) return fail('components 必填');
  const db = cloud.database();
  const now = Date.now();
  const doc = { name, slug, components, status: publish ? 1 : 0, updateTime: now };
  if (id) {
    await db.collection('lowcodePages').doc(id).update({ data: doc });
    return ok({ id, updated: true });
  }
  doc.createTime = now;
  doc.createBy = event._userId;
  const r = await db.collection('lowcodePages').add({ data: doc });
  return ok({ id: r._id });
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
  const res = await cloud.database().collection('lowcodePages')
    .orderBy('updateTime', 'desc').limit(50).get();
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

// ============== 报表 ==============
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
  const _ = db.command;
  let where = { status: _.gte(1) };
  if (cfg.range === 'today') where.createTime = _.gte(new Date(new Date().toDateString()).getTime());
  else if (cfg.range === '7d') where.createTime = _.gte(Date.now() - 7 * 86400000);
  else if (cfg.range === '30d') where.createTime = _.gte(Date.now() - 30 * 86400000);
  const data = await db.collection('orders').where(where).limit(2000).get();
  const groups = {};
  for (const o of data.data) {
    let k = 'all';
    if (cfg.dimension === 'date') k = new Date(o.createTime).toISOString().slice(0, 10);
    else if (cfg.dimension === 'shopId') k = o.shopId || 'default';
    else if (cfg.dimension === 'category') k = (o.goods && o.goods[0] && o.goods[0].categoryId) || 'default';
    if (!groups[k]) groups[k] = { key: k, value: 0, count: 0 };
    if (cfg.metric === 'revenue') groups[k].value += o.totalPrice || 0;
    else if (cfg.metric === 'count') groups[k].value++;
    groups[k].count++;
  }
  return ok({ list: Object.values(groups).map(g => ({ ...g, value: Number(g.value.toFixed(2)) })) });
}

async function listReports(event) {
  const res = await cloud.database().collection('lowcodeReports').orderBy('createTime', 'desc').limit(50).get();
  return ok(res.data);
}

// ============== 活动 ==============
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
  // 同步到真实活动表
  await syncToRealCampaign(type, name, config, event);
  return ok({ id: r._id });
}

async function syncToRealCampaign(type, name, config, event) {
  const db = cloud.database();
  if (type === 'full_reduce') {
    await db.collection('promos').add({
      data: {
        name, type: 'full_reduce', status: 1,
        minAmount: (config.tiers && config.tiers[0] && config.tiers[0].minAmount) || 0,
        fullAmount: (config.tiers && config.tiers[0] && config.tiers[0].minAmount) || 0,
        reduceAmount: (config.tiers && config.tiers[0] && config.tiers[0].reduceAmount) || 0,
        startTime: config.startTime || 0, endTime: config.endTime || 0,
        limitPerUser: config.limitPerUser || 1
      }
    }).catch(() => {});
  } else if (type === 'seckill') {
    await db.collection('seckillActivities').add({
      data: {
        name, status: 1,
        goodsId: config.goodsId, seckillPrice: config.seckillPrice,
        totalStock: config.totalStock || 0, stock: config.totalStock || 0,
        perUserLimit: config.perUserLimit || 1,
        startTime: config.startTime || 0, endTime: config.endTime || 0
      }
    }).catch(() => {});
  } else if (type === 'lucky_bag') {
    await db.collection('promos').add({
      data: {
        name, type: 'lucky_bag', status: 1,
        price: config.price, prizes: config.prizes
      }
    }).catch(() => {});
  }
}

async function listCampaigns(event) {
  const res = await cloud.database().collection('lowcodeCampaigns').orderBy('createTime', 'desc').limit(50).get();
  return ok(res.data);
}

async function applyCampaignTemplate(event) {
  const { templateId, name } = event;
  const tpl = CAMPAIGN_TEMPLATES[templateId] || MARKET_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return fail('模板不存在');
  return ok({ template: tpl, fields: tpl.fields || [] });
}

// ============== 表单生成器 ==============
async function saveForm(event) {
  const { id, name, slug, fields = [], submitAction = 'collectForm' } = event;
  if (!name || !Array.isArray(fields)) return fail('参数必填');
  const db = cloud.database();
  const now = Date.now();
  const doc = { name, slug, fields, submitAction, updateTime: now };
  if (id) {
    await db.collection('lowcodeForms').doc(id).update({ data: doc });
    return ok({ id });
  }
  doc.createTime = now;
  doc.createBy = event._userId;
  doc.submitCount = 0;
  const r = await db.collection('lowcodeForms').add({ data: doc });
  return ok({ id: r._id });
}

async function listForms(event) {
  const res = await cloud.database().collection('lowcodeForms').orderBy('updateTime', 'desc').limit(50).get();
  return ok(res.data);
}

async function getForm(event) {
  const { id = '', slug = '' } = event;
  const db = cloud.database();
  let r;
  if (id) r = await db.collection('lowcodeForms').doc(id).get();
  else if (slug) r = (await db.collection('lowcodeForms').where({ slug }).limit(1).get()).data[0];
  if (!r) return ok(null);
  return ok(r.data || r);
}

async function submitForm(event) {
  const { formId, data = {} } = event;
  if (!formId) return fail('formId 必填');
  const db = cloud.database();
  const now = Date.now();
  // 校验必填
  const form = await db.collection('lowcodeForms').doc(formId).get();
  if (!form.data) return fail('表单不存在');
  for (const f of form.data.fields) {
    if (f.required && !data[f.key]) return fail(`${f.label || f.key} 必填`);
  }
  // 写提交
  const r = await db.collection('lowcodeFormSubmissions').add({
    data: {
      formId, data, _openid: event._openid, _userId: event._userId,
      ip: cloud.getWXContext().CLIENTIP || '',
      createTime: now
    }
  });
  // 计数 +1
  await db.collection('lowcodeForms').doc(formId).update({
    data: { submitCount: db.command.inc(1) }
  });
  return ok({ id: r._id });
}

async function listSubmissions(event) {
  const { formId, page = 1, pageSize = 30 } = event;
  if (!formId) return fail('formId 必填');
  const res = await cloud.database().collection('lowcodeFormSubmissions')
    .where({ formId })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}

// ============== 业务规则引擎 ==============
async function saveRule(event) {
  const { id, name, trigger, condition, action, priority = 0, status = 1 } = event;
  if (!name || !trigger || !action) return fail('name/trigger/action 必填');
  const db = cloud.database();
  const now = Date.now();
  const doc = { name, trigger, condition: condition || '', action, priority, status, updateTime: now };
  if (id) {
    await db.collection('lowcodeRules').doc(id).update({ data: doc });
    return ok({ id });
  }
  doc.createTime = now;
  doc.createBy = event._userId;
  doc.hits = 0;
  const r = await db.collection('lowcodeRules').add({ data: doc });
  return ok({ id: r._id });
}

async function listRules(event) {
  const res = await cloud.database().collection('lowcodeRules').orderBy('priority', 'desc').limit(50).get();
  return ok(res.data);
}

async function toggleRule(event) {
  const { id, status } = event;
  if (!id) return fail('id 必填');
  await cloud.database().collection('lowcodeRules').doc(id).update({ data: { status, updateTime: Date.now() } });
  return ok({ ok: true });
}

async function deleteRule(event) {
  const { id } = event;
  if (!id) return fail('id 必填');
  await cloud.database().collection('lowcodeRules').doc(id).remove();
  return ok({ deleted: true });
}

// 规则试运行
async function testRule(event) {
  const { id, mockData = {} } = event;
  if (!id) return fail('id 必填');
  const r = await cloud.database().collection('lowcodeRules').doc(id).get();
  if (!r.data) return fail('规则不存在');
  const rule = r.data;

  // 模拟条件(简化:用 eval 表达式)
  let conditionMet = true;
  if (rule.condition) {
    try {
      // 极简表达式解析: "amount >= 100 && type == 'vip'"
      const expr = rule.condition
        .replace(/&&/g, '&&')
        .replace(/\|\|/g, '||')
        .replace(/([^=!<>])=([^=])/g, '$1===$2');
      // 安全:用 Function 构造
      const fn = new Function(...Object.keys(mockData), `return ${expr};`);
      conditionMet = !!fn(...Object.values(mockData));
    } catch (e) {
      return ok({ error: '条件解析失败:' + e.message });
    }
  }

  return ok({
    rule,
    conditionMet,
    action: rule.action,
    mockData,
    suggest: conditionMet ? `将执行:${rule.action}` : '条件不满足,跳过'
  });
}

// ============== 模板市场 ==============
async function applyTemplate(event) {
  const { templateId, name, config = {} } = event;
  const tpl = MARKET_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return fail('模板不存在');
  // 根据类型实例化
  if (tpl.category === 'campaign') {
    return saveCampaign({
      ...event,
      name: name || tpl.name,
      type: tpl.data.type,
      config: { ...tpl.data, ...config }
    });
  } else if (tpl.category === 'rule') {
    return saveRule({
      ...event,
      name: name || tpl.name,
      trigger: tpl.data.trigger,
      condition: tpl.data.condition || '',
      action: JSON.stringify(tpl.data.reward || tpl.data.action || tpl.data),
      priority: 10
    });
  }
  return ok({ template: tpl, message: '已应用' });
}
