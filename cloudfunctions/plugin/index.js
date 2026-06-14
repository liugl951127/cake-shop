// plugin - 插件市场
// 内置 5 套插件: 打印 / 短信 / 邮件 / 物流查询 / 支付渠道
// action: list / install / uninstall / call / config / log
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

// 内置插件目录
const PLUGINS = {
  print: {
    name: '小票打印',
    icon: '🖨️', category: 'order', description: '订单支付后自动打印小票,支持飞鹅/易联云/佳博',
    version: '1.2.0', author: '官方', installCount: 1024,
    config: { printerType: 'feie', sn: '', key: '', autoPrint: true }
  },
  sms: {
    name: '短信通知',
    icon: '📱', category: 'notify', description: '订单/支付/物流全流程短信提醒',
    version: '2.0.1', author: '官方', installCount: 856,
    config: { provider: 'aliyun', sign: '', templateCode: '', accessKey: '', secretKey: '' }
  },
  email: {
    name: '邮件通知',
    icon: '📧', category: 'notify', description: '订单/营销邮件',
    version: '1.1.0', author: '官方', installCount: 432,
    config: { smtpHost: 'smtp.qq.com', port: 465, user: '', pass: '', fromName: '' }
  },
  logistics: {
    name: '物流查询',
    icon: '🚚', category: 'delivery', description: '快递100/快递鸟',
    version: '1.5.0', author: '官方', installCount: 1287,
    config: { provider: 'kuaidi100', key: '', customer: '' }
  },
  payment: {
    name: '聚合支付',
    icon: '💳', category: 'payment', description: '微信/支付宝/银联 一键接入',
    version: '3.0.0', author: '官方', installCount: 2341,
    config: { providers: ['wechat', 'alipay'], merchantId: '' }
  },
  seo: {
    name: 'SEO 优化',
    icon: '🔍', category: 'promote', description: '百度/Google 自动收录',
    version: '1.0.0', author: '官方', installCount: 234,
    config: { sitemapAuto: true, robotsEnabled: true, baiduPush: false }
  },
  erp: {
    name: 'ERP 对接',
    icon: '🔗', category: 'system', description: 'SAP/用友/金蝶',
    version: '2.1.0', author: '官方', installCount: 67,
    config: { type: 'sap', endpoint: '', token: '' }
  },
  wechatWork: {
    name: '企业微信',
    icon: '🏢', category: 'system', description: '订单/客户/客服消息同步到企业微信',
    version: '1.3.0', author: '官方', installCount: 521,
    config: { corpId: '', agentId: '', secret: '' }
  }
};

exports.main = auth(async (event) => {
  const { action = 'list' } = event;
  switch (action) {
    case 'list': return listPlugins(event);
    case 'market': return pluginMarket(event);
    case 'install': return installPlugin(event);
    case 'uninstall': return uninstallPlugin(event);
    case 'config': return getConfig(event);
    case 'setConfig': return setConfig(event);
    case 'call': return callPlugin(event);
    case 'log': return getLog(event);
    default: return fail('未知 action');
  }
});

function listPlugins(event) {
  const list = Object.entries(PLUGINS).map(([key, p]) => ({ key, ...p }));
  return ok(list);
}

async function pluginMarket(event) {
  const { category = '', keyword = '' } = event;
  let list = Object.entries(PLUGINS).map(([key, p]) => ({ key, ...p }));
  if (category) list = list.filter(p => p.category === category);
  if (keyword) list = list.filter(p => (p.name + p.description).includes(keyword));
  // 标记已安装
  const db = cloud.database();
  const installed = await db.collection('pluginInstalls').where({ status: 1 }).get();
  const installedKeys = new Set(installed.data.map(i => i.pluginKey));
  for (const p of list) p.installed = installedKeys.has(p.key);
  return ok(list);
}

async function installPlugin(event) {
  const { pluginKey, config = {} } = event;
  if (!PLUGINS[pluginKey]) return fail('未知插件');
  const db = cloud.database();
  const now = Date.now();
  // 装 / 重新装
  const exist = await db.collection('pluginInstalls').where({ pluginKey }).limit(1).get();
  if (exist.data[0]) {
    await db.collection('pluginInstalls').doc(exist.data[0]._id).update({
      data: { status: 1, config: { ...PLUGINS[pluginKey].config, ...config }, updateTime: now }
    });
  } else {
    await db.collection('pluginInstalls').add({
      data: {
        pluginKey, status: 1,
        config: { ...PLUGINS[pluginKey].config, ...config },
        installTime: now, updateTime: now
      }
    });
  }
  await audit.write(event, 'plugin_install', 'plugin', pluginKey, {});
  return ok({ installed: true });
}

async function uninstallPlugin(event) {
  const { pluginKey } = event;
  if (!PLUGINS[pluginKey]) return fail('未知插件');
  const db = cloud.database();
  await db.collection('pluginInstalls').where({ pluginKey }).update({ data: { status: 0, updateTime: Date.now() } });
  await audit.write(event, 'plugin_uninstall', 'plugin', pluginKey, {});
  return ok({ uninstalled: true });
}

async function getConfig(event) {
  const { pluginKey } = event;
  if (!PLUGINS[pluginKey]) return fail('未知插件');
  const db = cloud.database();
  const r = await db.collection('pluginInstalls').where({ pluginKey, status: 1 }).limit(1).get();
  return ok({
    plugin: PLUGINS[pluginKey],
    installed: r.data.length > 0,
    config: r.data[0] ? r.data[0].config : PLUGINS[pluginKey].config
  });
}

async function setConfig(event) {
  const { pluginKey, config = {} } = event;
  if (!PLUGINS[pluginKey]) return fail('未知插件');
  const db = cloud.database();
  const now = Date.now();
  const exist = await db.collection('pluginInstalls').where({ pluginKey }).limit(1).get();
  if (exist.data[0]) {
    await db.collection('pluginInstalls').doc(exist.data[0]._id).update({
      data: { config: { ...exist.data[0].config, ...config }, updateTime: now }
    });
  } else {
    await db.collection('pluginInstalls').add({
      data: { pluginKey, status: 1, config, installTime: now, updateTime: now }
    });
  }
  return ok({ ok: true });
}

// 调用插件(执行具体动作,如"打印小票")
async function callPlugin(event) {
  const { pluginKey, action, payload = {} } = event;
  if (!PLUGINS[pluginKey]) return fail('未知插件');
  const db = cloud.database();
  const r = await db.collection('pluginInstalls').where({ pluginKey, status: 1 }).limit(1).get();
  if (!r.data[0]) return fail('插件未安装');
  const config = r.data[0].config;
  const now = Date.now();
  let result = null;
  try {
    switch (pluginKey) {
      case 'print':
        result = await doPrint(action, payload, config);
        break;
      case 'sms':
        result = await doSms(action, payload, config);
        break;
      case 'email':
        result = await doEmail(action, payload, config);
        break;
      case 'logistics':
        result = await doLogistics(action, payload, config);
        break;
      case 'payment':
        result = await doPayment(action, payload, config);
        break;
      default:
        result = { ok: true, simulated: true };
    }
  } catch (e) {
    result = { error: e.message };
  }
  // 写调用日志
  await db.collection('pluginLogs').add({
    data: {
      pluginKey, action, payload, config: {}, result,
      success: !result.error,
      createTime: now
    }
  }).catch(() => {});
  return ok(result);
}

async function doPrint(action, payload, config) {
  // 真实环境: 调飞鹅/易联云 HTTP API
  if (!config.sn) return { simulated: true, message: '请先配置打印机 SN' };
  console.log(`[print] ${action}`, payload);
  return { ok: true, simulated: true };
}

async function doSms(action, payload, config) {
  if (!config.accessKey) return { simulated: true };
  console.log(`[sms] ${action}`, payload);
  return { ok: true, simulated: true };
}

async function doEmail(action, payload, config) {
  console.log(`[email] ${action}`, payload);
  return { ok: true, simulated: true };
}

async function doLogistics(action, payload, config) {
  if (!config.key) return { simulated: true };
  // 调快递 100
  if (action === 'query' && payload.no) {
    return {
      ok: true,
      simulated: true,
      no: payload.no,
      traces: [
        { time: Date.now() - 86400000, info: '已揽收' },
        { time: Date.now() - 43200000, info: '运输中' }
      ]
    };
  }
  return { ok: true, simulated: true };
}

async function doPayment(action, payload, config) {
  console.log(`[payment] ${action}`, payload);
  return { ok: true, simulated: true };
}

async function getLog(event) {
  const { pluginKey = '', page = 1, pageSize = 30 } = event;
  const db = cloud.database();
  const where = {};
  if (pluginKey) where.pluginKey = pluginKey;
  const res = await db.collection('pluginLogs').where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}
