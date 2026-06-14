// inventory - 进销存 + 供应链
// action: in / out / transfer / stock / warn / list / adjust / purchase / purchaseList
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

exports.main = auth(async (event) => {
  const { action = 'stock' } = event;
  switch (action) {
    case 'in': return stockIn(event);
    case 'out': return stockOut(event);
    case 'transfer': return transferStock(event);
    case 'stock': return getStock(event);
    case 'warn': return getWarn(event);
    case 'list': return getStockList(event);
    case 'adjust': return adjustStock(event);
    case 'purchase': return purchaseIn(event);
    case 'purchaseList': return purchaseList(event);
    case 'check': return stockCheck(event);
    default: return fail('未知 action');
  }
});

// 入库
async function stockIn(event) {
  const { items = [], reason = '', refOrderId = '', shopId = '' } = event;
  if (!items.length) return fail('入库明细必填');
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const log = {
    type: 'in', items, reason, refOrderId, shopId,
    operator: event._userId, operatorName: event._userName || '',
    createTime: now
  };
  const res = await db.collection('stockLogs').add({ data: log });
  // 增量更新库存
  for (const it of items) {
    await db.collection('inventory').where({ skuId: it.skuId, shopId }).update({
      data: { stock: _.inc(it.qty || 0), updateTime: now, lastInTime: now }
    }).catch(async () => {
      await db.collection('inventory').add({
        data: {
          skuId: it.skuId, skuName: it.skuName, shopId,
          stock: it.qty || 0, warnStock: 0, updateTime: now, lastInTime: now
        }
      });
    });
  }
  await audit.write(event, 'stock_in', 'inventory', res._id, { count: items.length });
  return ok({ id: res._id, count: items.length });
}

// 出库
async function stockOut(event) {
  const { items = [], reason = '', refOrderId = '', shopId = '' } = event;
  if (!items.length) return fail('出库明细必填');
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  // 校验库存
  for (const it of items) {
    const cur = await db.collection('inventory').where({ skuId: it.skuId, shopId }).limit(1).get();
    const have = (cur.data[0] && cur.data[0].stock) || 0;
    if (have < (it.qty || 0)) return fail(`SKU ${it.skuName} 库存不足(${have}<${it.qty})`, -1);
  }

  const log = {
    type: 'out', items, reason, refOrderId, shopId,
    operator: event._userId, operatorName: event._userName || '',
    createTime: now
  };
  const res = await db.collection('stockLogs').add({ data: log });
  for (const it of items) {
    await db.collection('inventory').where({ skuId: it.skuId, shopId }).update({
      data: { stock: _.inc(-(it.qty || 0)), updateTime: now, lastOutTime: now }
    });
  }
  await audit.write(event, 'stock_out', 'inventory', res._id, { count: items.length });
  return ok({ id: res._id, count: items.length });
}

// 调拨(A 店 → B 店)
async function transferStock(event) {
  const { items = [], fromShopId = '', toShopId = '', reason = '' } = event;
  if (!fromShopId || !toShopId) return fail('调出/调入门店必填');
  if (fromShopId === toShopId) return fail('不能调拨到本店');
  if (!items.length) return fail('调拨明细必填');
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  for (const it of items) {
    const cur = await db.collection('inventory').where({ skuId: it.skuId, shopId: fromShopId }).limit(1).get();
    const have = (cur.data[0] && cur.data[0].stock) || 0;
    if (have < (it.qty || 0)) return fail(`${it.skuName} 调出门店库存不足`);
  }

  const log = {
    type: 'transfer', items, fromShopId, toShopId, reason,
    operator: event._userId, operatorName: event._userName || '',
    createTime: now
  };
  const res = await db.collection('stockLogs').add({ data: log });
  for (const it of items) {
    await db.collection('inventory').where({ skuId: it.skuId, shopId: fromShopId }).update({
      data: { stock: _.inc(-(it.qty || 0)), updateTime: now }
    });
    await db.collection('inventory').where({ skuId: it.skuId, shopId: toShopId }).update({
      data: { stock: _.inc(it.qty || 0), updateTime: now }
    }).catch(async () => {
      await db.collection('inventory').add({
        data: { skuId: it.skuId, skuName: it.skuName, shopId: toShopId, stock: it.qty || 0, updateTime: now }
      });
    });
  }
  await audit.write(event, 'stock_transfer', 'inventory', res._id, { fromShopId, toShopId, count: items.length });
  return ok({ id: res._id });
}

// 库存查询
async function getStock(event) {
  const { skuId, shopId } = event;
  const db = cloud.database();
  const where = {};
  if (skuId) where.skuId = skuId;
  if (shopId) where.shopId = shopId;
  const res = await db.collection('inventory').where(where).limit(100).get();
  return ok(res.data);
}

// 库存列表 + 汇总
async function getStockList(event) {
  const { shopId = '', keyword = '', page = 1, pageSize = 30 } = event;
  const db = cloud.database();
  const _ = db.command;
  const where = {};
  if (shopId) where.shopId = shopId;
  if (keyword) {
    where.skuName = db.RegExp({ regexp: keyword, options: 'i' });
  }
  const res = await db.collection('inventory').where(where)
    .orderBy('updateTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  // 汇总
  const totalRes = await db.collection('inventory').where(where).limit(1000).get();
  const totalStock = totalRes.data.reduce((s, x) => s + (x.stock || 0), 0);
  const totalValue = totalRes.data.reduce((s, x) => s + (x.stock || 0) * (x.costPrice || 0), 0);
  const lowCount = totalRes.data.filter(x => (x.stock || 0) <= (x.warnStock || 0)).length;
  return ok({
    list: res.data,
    summary: { totalStock, totalValue: Number(totalValue.toFixed(2)), lowCount, skuCount: totalRes.data.length },
    hasMore: res.data.length === pageSize
  });
}

// 预警(库存 ≤ 警戒值)
async function getWarn(event) {
  const db = cloud.database();
  const _ = db.command;
  // 简化:直接 list 再过滤
  const res = await db.collection('inventory').where({}).limit(1000).get();
  const warns = res.data.filter(x => (x.stock || 0) <= (x.warnStock || 0));
  return ok(warns);
}

// 盘点
async function adjustStock(event) {
  const { skuId, shopId = '', newStock, reason = '' } = event;
  if (!skuId || newStock === undefined) return fail('skuId + newStock 必填');
  const db = cloud.database();
  const _ = db.command;
  const where = { skuId };
  if (shopId) where.shopId = shopId;
  const cur = await db.collection('inventory').where(where).limit(1).get();
  const oldStock = (cur.data[0] && cur.data[0].stock) || 0;
  const diff = newStock - oldStock;

  await db.collection('inventory').where(where).update({
    data: { stock: newStock, updateTime: Date.now() }
  });
  await db.collection('stockLogs').add({
    data: {
      type: 'adjust', items: [{ skuId, skuName: cur.data[0] && cur.data[0].skuName, qty: Math.abs(diff) }],
      diff, oldStock, newStock, reason, shopId,
      operator: event._userId, operatorName: event._userName || '',
      createTime: Date.now()
    }
  });
  await audit.write(event, 'stock_adjust', 'inventory', skuId, { oldStock, newStock });
  return ok({ diff });
}

// 采购入库
async function purchaseIn(event) {
  const { items = [], supplier = '', cost = 0, refNo = '', shopId = '' } = event;
  if (!items.length) return fail('采购明细必填');
  const db = cloud.database();
  const now = Date.now();

  const purchase = {
    items, supplier, cost: Number(cost), refNo, shopId,
    status: 1,  // 1-已入库
    operator: event._userId, operatorName: event._userName || '',
    createTime: now
  };
  const res = await db.collection('purchases').add({ data: purchase });
  // 直接入库
  await stockIn({ ...event, items, reason: '采购入库:' + (refNo || supplier), shopId });
  return ok({ id: res._id });
}

// 采购单列表
async function purchaseList(event) {
  const { page = 1, pageSize = 20, shopId = '' } = event;
  const db = cloud.database();
  const where = {};
  if (shopId) where.shopId = shopId;
  const res = await db.collection('purchases').where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, hasMore: res.data.length === pageSize });
}

// 销售出库(下单时自动调)
async function stockCheck(event) {
  const { items = [], shopId = '' } = event;
  const db = cloud.database();
  const lack = [];
  for (const it of items) {
    const cur = await db.collection('inventory').where({ skuId: it.skuId, shopId }).limit(1).get();
    const have = (cur.data[0] && cur.data[0].stock) || 0;
    if (have < (it.qty || 0)) {
      lack.push({ skuId: it.skuId, skuName: it.skuName, have, need: it.qty });
    }
  }
  return ok({ ok: lack.length === 0, lack });
}
