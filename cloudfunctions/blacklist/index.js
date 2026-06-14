// blacklist - 黑名单库
// 支持 5 类目标: 用户 / 设备 / IP / 手机 / 身份证
// 动作: add / remove / list / check / sync / import / export
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

const TYPES = ['user', 'device', 'ip', 'phone', 'idcard'];

exports.main = auth(async (event) => {
  const { action = 'list' } = event;
  switch (action) {
    case 'add': return addBlack(event);
    case 'remove': return removeBlack(event);
    case 'list': return listBlack(event);
    case 'check': return checkBlack(event);
    case 'syncUser': return syncUserBlack(event);
    case 'import': return importBlack(event);
    case 'export': return exportBlack(event);
    default: return fail('未知 action');
  }
});

// 加黑
async function addBlack(event) {
  const { type, value, reason = '', level = 'high', expireTime = 0, source = 'manual' } = event;
  if (!TYPES.includes(type)) return fail('type 必填,可选: ' + TYPES.join(','));
  if (!value) return fail('value 必填');
  const db = cloud.database();
  const now = Date.now();

  // 查重
  const exist = await db.collection('blacklist')
    .where({ targetType: type, targetValue: value, status: 1 })
    .limit(1)
    .get();
  if (exist.data[0]) return fail('已在黑名单中');

  const doc = {
    targetType: type,
    targetValue: value,
    targetId: type === 'user' ? value : '',
    level,  // high/medium/low
    reason,
    source,  // manual/auto/riskEngine/external
    status: 1,
    expireTime,
    hits: 0,
    createBy: event._userId,
    createByName: event._userName || '',
    createTime: now,
    updateTime: now
  };
  const r = await db.collection('blacklist').add({ data: doc });

  // 如果是 user,同步更新 users.blacklisted
  if (type === 'user') {
    await db.collection('users').doc(value).update({
      data: { blacklisted: true, blacklistedReason: reason, blacklistedTime: now }
    }).catch(() => {});
  }

  await audit.write(event, 'blacklist_add', 'blacklist', r._id, { type, value, reason, level });
  return ok({ id: r._id });
}

// 移黑
async function removeBlack(event) {
  const { id, type, value } = event;
  const db = cloud.database();
  let where = { status: 1 };
  if (id) where._id = id;
  else if (type && value) {
    where.targetType = type;
    where.targetValue = value;
  } else {
    return fail('id 或 (type+value) 必填');
  }

  const list = await db.collection('blacklist').where(where).get();
  for (const item of list.data) {
    await db.collection('blacklist').doc(item._id).update({
      data: { status: 0, removeTime: Date.now() }
    });
    // 同步用户
    if (item.targetType === 'user') {
      await db.collection('users').doc(item.targetValue).update({
        data: { blacklisted: false, blacklistedReason: '', blacklistedTime: 0 }
      }).catch(() => {});
    }
  }

  await audit.write(event, 'blacklist_remove', 'blacklist', id || `${type}:${value}`, {});
  return ok({ removed: list.data.length });
}

async function listBlack(event) {
  const { type = '', level = '', keyword = '', page = 1, pageSize = 20 } = event;
  const db = cloud.database();
  const where = { status: 1 };
  if (type) where.targetType = type;
  if (level) where.level = level;
  if (keyword) {
    where.targetValue = db.RegExp({ regexp: keyword, options: 'i' });
  }
  const res = await db.collection('blacklist').where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}

// 检查(单次)
async function checkBlack(event) {
  const { type, value } = event;
  if (!type || !value) return fail('type + value 必填');
  const db = cloud.database();
  const r = await db.collection('blacklist')
    .where({ targetType: type, targetValue: value, status: 1 })
    .limit(1)
    .get();
  if (r.data[0]) {
    // 命中 +1
    await db.collection('blacklist').doc(r.data[0]._id).update({
      data: { hits: db.command.inc(1), lastHitTime: Date.now() }
    }).catch(() => {});
    return ok({
      blacklisted: true,
      reason: r.data[0].reason,
      level: r.data[0].level,
      source: r.data[0].source
    });
  }
  return ok({ blacklisted: false });
}

// 把 riskEngine 自动加黑的同步到 blacklist
async function syncUserBlack(event) {
  const db = cloud.database();
  // 找 riskEngineLogs 中 decision=reject 且 userId 不在 blacklist 的
  const logs = await db.collection('riskEngineLogs')
    .where({ decision: 'reject', reviewStatus: 'auto' })
    .orderBy('createTime', 'desc')
    .limit(200)
    .get();

  let added = 0;
  for (const l of logs.data) {
    if (!l.userId) continue;
    // 已存在?
    const exist = await db.collection('blacklist')
      .where({ targetType: 'user', targetValue: l.userId, status: 1 })
      .limit(1)
      .get();
    if (exist.data[0]) continue;

    const reason = '风控自动加黑: ' + l.factors.filter(f => f.hit).map(f => f.code).join(',');
    await db.collection('blacklist').add({
      data: {
        targetType: 'user', targetValue: l.userId, targetId: l.userId,
        level: 'high', reason, source: 'riskEngine', status: 1,
        hits: 0, createBy: 'system', createByName: '系统', createTime: Date.now()
      }
    }).catch(() => {});
    await db.collection('users').doc(l.userId).update({
      data: { blacklisted: true, blacklistedReason: reason, blacklistedTime: Date.now() }
    }).catch(() => {});
    added++;
  }
  return ok({ added });
}

// 批量导入
async function importBlack(event) {
  const { items = [] } = event;
  if (!items.length) return fail('items 必填');
  const db = cloud.database();
  const now = Date.now();
  let added = 0, skip = 0;
  for (const it of items) {
    if (!TYPES.includes(it.type) || !it.value) { skip++; continue; }
    const exist = await db.collection('blacklist')
      .where({ targetType: it.type, targetValue: it.value, status: 1 })
      .limit(1)
      .get();
    if (exist.data[0]) { skip++; continue; }
    await db.collection('blacklist').add({
      data: {
        targetType: it.type, targetValue: it.value,
        level: it.level || 'medium', reason: it.reason || '',
        source: 'import', status: 1, hits: 0,
        createBy: event._userId, createByName: event._userName || '',
        createTime: now
      }
    }).catch(() => {});
    added++;
  }
  return ok({ added, skip });
}

// 导出
async function exportBlack(event) {
  const { type = '', level = '' } = event;
  const db = cloud.database();
  const where = { status: 1 };
  if (type) where.targetType = type;
  if (level) where.level = level;
  const res = await db.collection('blacklist').where(where).limit(2000).get();
  // 转 CSV
  const header = 'type,value,level,reason,source,hits,createTime\n';
  const csv = header + res.data.map(b => [
    b.targetType, b.targetValue, b.level, b.reason || '', b.source || '',
    b.hits || 0, new Date(b.createTime).toISOString()
  ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(',')).join('\n');
  return ok({ csv, count: res.data.length });
}
