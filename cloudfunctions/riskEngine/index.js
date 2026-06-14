// riskEngine - 风险规则引擎
// 统一风控决策中心
// action:  check / rules / logs / dashboard / addRule / updateRule
//
// 设计: 决策表(decision table)
//   event  →  score  →  level  →  action
//   低(<40)  →  pass
//   中(40-69) →  needVerify(实名/活体/短信)
//   高(≥70) →  reject(直接拒绝) / manual(人工审核)
//
// 规则:可插拔,每条规则独立函数 + 配置,运行期可加
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

const { checkBlacklist } = require('./lib/blacklist.js');
const { checkAuth } = require('./lib/auth.js');
const { checkBehavior } = require('./lib/behavior.js');
const { checkDevice } = require('./lib/device.js');

// 内置规则(用户可扩展)
const BUILTIN_RULES = [
  // 黑名单(0 分直接 reject)
  { code: 'BLACKLIST_USER',   category: 'identity',  weight: 100, level: 'reject',  run: checkBlacklist.user },
  { code: 'BLACKLIST_DEVICE', category: 'identity',  weight: 90,  level: 'reject',  run: checkBlacklist.device },
  { code: 'BLACKLIST_IP',     category: 'identity',  weight: 90,  level: 'reject',  run: checkBlacklist.ip },
  { code: 'BLACKLIST_PHONE',  category: 'identity',  weight: 100, level: 'reject',  run: checkBlacklist.phone },
  { code: 'BLACKLIST_IDCARD', category: 'identity',  weight: 100, level: 'reject',  run: checkBlacklist.idcard },

  // 身份认证阈值门控
  { code: 'NEED_REALNAME',    category: 'auth',      weight: 30,  level: 'verify',  run: checkAuth.realName },
  { code: 'NEED_LIVENESS',    category: 'auth',      weight: 50,  level: 'verify',  run: checkAuth.liveness },
  { code: 'NEED_BANKCARD',    category: 'auth',      weight: 60,  level: 'verify',  run: checkAuth.bankCard },

  // 行为画像
  { code: 'NEW_USER_HIGH_AMOUNT', category: 'behavior', weight: 35, level: 'manual', run: checkBehavior.newUserHigh },
  { code: 'FREQUENT_REFUND',       category: 'behavior', weight: 30, level: 'verify', run: checkBehavior.frequentRefund },
  { code: 'NIGHT_ORDER',           category: 'behavior', weight: 15, level: 'pass',   run: checkBehavior.nightOrder },
  { code: 'ABNORMAL_ADDRESS',      category: 'behavior', weight: 25, level: 'verify', run: checkBehavior.abnormalAddress },

  // 设备/IP
  { code: 'SAME_DEVICE_MULTI',     category: 'device',   weight: 35, level: 'verify', run: checkDevice.sameDeviceMulti },
  { code: 'IP_FREQUENT',           category: 'device',   weight: 20, level: 'pass',   run: checkDevice.ipFrequent },
  { code: 'IP_DIFF_CITY',          category: 'device',   weight: 25, level: 'verify', run: checkDevice.ipDiffCity }
];

const SCENARIO_RULES = {
  // 不同场景,启用不同规则集
  pay:        ['BLACKLIST_USER', 'BLACKLIST_DEVICE', 'BLACKLIST_IP', 'NEED_REALNAME', 'NEW_USER_HIGH_AMOUNT', 'NIGHT_ORDER', 'SAME_DEVICE_MULTI', 'IP_DIFF_CITY'],
  withdraw:   ['BLACKLIST_USER', 'BLACKLIST_PHONE', 'BLACKLIST_IDCARD', 'NEED_REALNAME', 'NEED_LIVENESS', 'NEED_BANKCARD', 'FREQUENT_REFUND', 'SAME_DEVICE_MULTI'],
  login:      ['BLACKLIST_USER', 'BLACKLIST_DEVICE', 'BLACKLIST_IP', 'IP_DIFF_CITY'],
  register:   ['BLACKLIST_IP', 'BLACKLIST_DEVICE', 'BLACKLIST_PHONE', 'BLACKLIST_IDCARD', 'SAME_DEVICE_MULTI'],
  chatJoin:   ['BLACKLIST_USER', 'NEED_REALNAME'],
  highOrder:  ['BLACKLIST_USER', 'BLACKLIST_DEVICE', 'BLACKLIST_IP', 'BLACKLIST_IDCARD', 'NEED_REALNAME', 'NEED_LIVENESS', 'NEW_USER_HIGH_AMOUNT', 'SAME_DEVICE_MULTI', 'ABNORMAL_ADDRESS']
};

const SCENARIO_THRESHOLDS = {
  pay:        { reject: 90, manual: 70, verify: 40 },
  withdraw:   { reject: 90, manual: 70, verify: 50 },
  login:      { reject: 80, manual: 60, verify: 30 },
  register:   { reject: 80, manual: 50, verify: 30 },
  chatJoin:   { reject: 80, manual: 60, verify: 30 },
  highOrder:  { reject: 90, manual: 60, verify: 40 },
  default:    { reject: 90, manual: 70, verify: 40 }
};

exports.main = auth(async (event) => {
  const { action = 'check' } = event;
  switch (action) {
    case 'check': return doCheck(event);
    case 'rules': return listRules(event);
    case 'addRule': return addRule(event);
    case 'updateRule': return updateRule(event);
    case 'deleteRule': return deleteRule(event);
    case 'logs': return getLogs(event);
    case 'dashboard': return getDashboard(event);
    case 'review': return manualReview(event);
    default: return fail('未知 action');
  }
});

// 主决策函数
async function doCheck(event) {
  const {
    scenario = 'pay',
    userId = '',
    openid = '',
    deviceId = '',
    ip = '',
    phone = '',
    idCardHash = '',
    orderId = '',
    amount = 0,
    extra = {}
  } = event;

  // 1. 加载该场景的规则
  const scenarioRuleCodes = SCENARIO_RULES[scenario] || [];
  const customRules = await loadCustomRules(cloud.database());
  const allRules = [...BUILTIN_RULES, ...customRules];
  const ruleMap = {};
  for (const r of allRules) ruleMap[r.code] = r;
  const rules = scenarioRuleCodes.map(code => ruleMap[code]).filter(Boolean);

  // 2. 准备上下文
  const ctx = {
    userId, openid, deviceId, ip, phone, idCardHash,
    orderId, amount, scenario, extra,
    db: cloud.database(),
    cloud
  };

  // 3. 跑规则
  const factors = [];
  for (const r of rules) {
    let hit = false, detail = '';
    try {
      const res = await r.run(ctx);
      hit = res && res.hit;
      detail = res && res.detail || '';
    } catch (e) {
      console.error(`[risk] rule ${r.code} fail:`, e.message);
    }
    factors.push({
      code: r.code, category: r.category, weight: r.weight,
      level: r.level, hit, detail
    });
  }

  // 4. 汇总
  const totalScore = factors.filter(f => f.hit).reduce((s, f) => s + f.weight, 0);
  const threshold = SCENARIO_THRESHOLDS[scenario] || SCENARIO_THRESHOLDS.default;
  let decision = 'pass';
  let requireAction = null;
  if (totalScore >= threshold.reject) {
    decision = 'reject';
  } else if (totalScore >= threshold.manual) {
    decision = 'manual';
  } else if (totalScore >= threshold.verify) {
    decision = 'verify';
    // 找出需要补充的认证
    const needAuth = factors.filter(f => f.hit && f.category === 'auth');
    if (needAuth.length) {
      requireAction = needAuth.map(f => f.code.replace('NEED_', '').toLowerCase());
    }
  }

  // 5. 写日志
  const now = Date.now();
  const log = {
    scenario, userId, openid, deviceId, ip, phone, idCardHash,
    orderId, amount,
    factors, totalScore, threshold, decision, requireAction,
    operatorId: event._userId,
    reviewStatus: decision === 'manual' ? 'pending' : 'auto',
    createTime: now
  };
  const db = cloud.database();
  const res = await db.collection('riskEngineLogs').add({ data: log }).catch(() => ({ _id: null }));

  // 6. 自动 reject 直接停业务
  if (decision === 'reject' && scenario === 'pay' && orderId) {
    await db.collection('orders').doc(orderId).update({
      data: { status: -3, rejectReason: '风控拦截', updateTime: now }
    }).catch(() => {});
  }
  if (decision === 'reject' && scenario === 'withdraw') {
    await db.collection('withdraws').where({ _userId: userId, status: 0 }).update({
      data: { status: -1, rejectReason: '风控拦截', updateTime: now }
    }).catch(() => {});
  }

  return ok({
    decision,
    totalScore,
    threshold,
    requireAction,
    factors: factors.filter(f => f.hit),
    logId: res._id,
    reviewStatus: log.reviewStatus
  });
}

async function listRules(event) {
  const customRules = await loadCustomRules(cloud.database());
  return ok({
    builtin: BUILTIN_RULES.map(r => ({ code: r.code, category: r.category, weight: r.weight, level: r.level })),
    custom: customRules,
    scenarios: SCENARIO_RULES,
    thresholds: SCENARIO_THRESHOLDS
  });
}

async function loadCustomRules(db) {
  const res = await db.collection('riskCustomRules').where({ status: 1 }).get();
  return res.data || [];
}

async function addRule(event) {
  const { code, name, category, weight, level, condition } = event;
  if (!code || !name || !condition) return fail('参数必填');
  const db = cloud.database();
  const now = Date.now();
  const r = await db.collection('riskCustomRules').add({
    data: { code, name, category, weight, level, condition, status: 1, createTime: now }
  });
  return ok({ id: r._id });
}

async function updateRule(event) {
  const { id, status, weight } = event;
  const db = cloud.database();
  const update = { updateTime: Date.now() };
  if (status !== undefined) update.status = status;
  if (weight !== undefined) update.weight = weight;
  await db.collection('riskCustomRules').doc(id).update({ data: update });
  return ok({ ok: true });
}

async function deleteRule(event) {
  const { id } = event;
  await cloud.database().collection('riskCustomRules').doc(id).remove();
  return ok({ deleted: true });
}

async function getLogs(event) {
  const { scenario = '', decision = '', page = 1, pageSize = 30 } = event;
  const db = cloud.database();
  const where = {};
  if (scenario) where.scenario = scenario;
  if (decision) where.decision = decision;
  const res = await db.collection('riskEngineLogs').where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}

async function getDashboard(event) {
  const db = cloud.database();
  const _ = db.command;
  const today = new Date(new Date().toDateString()).getTime();

  // 今日统计
  const todayRes = await db.collection('riskEngineLogs').where({ createTime: _.gte(today) }).limit(2000).get();
  const total = todayRes.data.length;
  const stats = { pass: 0, verify: 0, manual: 0, reject: 0 };
  for (const l of todayRes.data) stats[l.decision] = (stats[l.decision] || 0) + 1;

  // 命中规则 Top 5
  const ruleHits = {};
  for (const l of todayRes.data) {
    for (const f of (l.factors || [])) {
      if (f.hit) ruleHits[f.code] = (ruleHits[f.code] || 0) + 1;
    }
  }
  const topRules = Object.entries(ruleHits).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // 待人工审核
  const pending = await db.collection('riskEngineLogs')
    .where({ reviewStatus: 'pending' })
    .count();

  // 7 日拦截趋势
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const dStart = today - i * 86400000;
    const dEnd = dStart + 86400000;
    const dayLogs = todayRes.data.filter(l => l.createTime >= dStart && l.createTime < dEnd);
    trend.push({
      date: new Date(dStart).toISOString().slice(5, 10),
      pass: dayLogs.filter(l => l.decision === 'pass').length,
      verify: dayLogs.filter(l => l.decision === 'verify').length,
      manual: dayLogs.filter(l => l.decision === 'manual').length,
      reject: dayLogs.filter(l => l.decision === 'reject').length
    });
  }

  return ok({
    today: { total, ...stats, rejectRate: total > 0 ? Number((stats.reject / total * 100).toFixed(2)) : 0 },
    pendingReview: pending.total,
    topRules: topRules.map(([code, count]) => ({ code, count })),
    trend
  });
}

async function manualReview(event) {
  const { logId, action, note = '' } = event;
  if (!logId || !['approve', 'reject'].includes(action)) return fail('参数错误');
  const db = cloud.database();
  const log = await db.collection('riskEngineLogs').doc(logId).get();
  if (!log.data) return fail('记录不存在', -404);
  if (log.data.reviewStatus !== 'pending') return fail('已审核');

  const now = Date.now();
  const update = {
    reviewStatus: action === 'approve' ? 'approved' : 'rejected',
    reviewBy: event._userId,
    reviewByName: event._userName || '',
    reviewNote: note,
    reviewTime: now
  };
  await db.collection('riskEngineLogs').doc(logId).update({ data: update });

  // 联动:如果通过,订单继续;如果拒绝,订单状态变更
  if (action === 'reject' && log.data.orderId) {
    await db.collection('orders').doc(log.data.orderId).update({
      data: { status: -3, rejectReason: '风控拒绝:' + (note || '人工审核'), updateTime: now }
    }).catch(() => {});
  }
  await audit.write(event, 'risk_review_' + action, 'risk', logId, { note });
  return ok({ ok: true });
}
