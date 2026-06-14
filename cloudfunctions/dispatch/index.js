// dispatch - 履约调度
// action: pool / assign / grab / status / route / myTasks / checkin
const { cloud, ok, fail, auth } = require('../common/index.js');
const audit = require('../common/audit.js');

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

exports.main = auth(async (event) => {
  const { action = 'pool' } = event;
  switch (action) {
    case 'pool': return getTaskPool(event);
    case 'assign': return assignOrder(event);
    case 'grab': return grabTask(event);
    case 'status': return updateStatus(event);
    case 'route': return planRoute(event);
    case 'myTasks': return myTasks(event);
    case 'checkin': return riderCheckin(event);
    case 'riders': return getRiders(event);
    default: return fail('未知 action');
  }
});

// 任务池(待分配订单)
async function getTaskPool(event) {
  const { city = '', shopId = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const where = {
    status: 1,           // 已支付待发货
    dispatchStatus: 0,   // 0-未分配
    expressType: 'intra' // 同城
  };
  if (city) where.city = city;
  if (shopId) where.shopId = shopId;
  const res = await db.collection('orders').where(where)
    .orderBy('payTime', 'asc')
    .limit(50)
    .get();
  return ok(res.data);
}

// 智能派单(找最近 + 负载最低的骑手)
async function assignOrder(event) {
  const { orderId, shopId = '' } = event;
  if (!orderId) return fail('orderId 必填');
  const db = cloud.database();
  const _ = db.command;
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) return fail('订单不存在', -404);
  const o = order.data;
  if (o.dispatchStatus >= 1) return fail('已被分配');

  // 找候选骑手(同城市 + 在线 + 接单中)
  const candidates = await db.collection('riders')
    .where({
      online: true, acceptStatus: 1, busy: false,
      ...(o.city ? { city: o.city } : {})
    })
    .limit(30)
    .get();

  if (!candidates.data.length) {
    return ok({ assigned: false, reason: 'no_rider' });
  }

  // 打分:距离权重 0.6 + 负载权重 0.3 + 评分 0.1
  const scored = candidates.data.map(r => {
    let dist = 999;
    if (r.lat && r.lng && o.address && o.address.lat) {
      dist = haversine(r.lat, r.lng, o.address.lat, o.address.lng);
    }
    const distScore = Math.max(0, 100 - dist * 20);
    const loadScore = Math.max(0, 100 - (r.currentTasks || 0) * 20);
    const rateScore = (r.rating || 5) * 20;
    return { rider: r, score: distScore * 0.6 + loadScore * 0.3 + rateScore * 0.1, dist };
  });
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // 写派单
  const now = Date.now();
  const dispatch = {
    orderId, riderId: winner.rider._id, riderName: winner.rider.name,
    status: 1,   // 1-已派单 2-已取货 3-已送达 4-已完成 -1-取消
    from: { name: '门店', lat: winner.rider.lat || 0, lng: winner.rider.lng || 0 },
    to: { name: (o.address && o.address.name) || '', address: (o.address && o.address.address) || '', lat: (o.address && o.address.lat) || 0, lng: (o.address && o.address.lng) || 0 },
    distance: winner.dist,
    assignTime: now, pickupTime: 0, arriveTime: 0, completeTime: 0,
    fee: calcDeliveryFee(winner.dist)
  };
  const res = await db.collection('dispatches').add({ data: dispatch });
  // 改订单
  await db.collection('orders').doc(orderId).update({
    data: {
      dispatchStatus: 1, dispatchId: res._id, riderId: winner.rider._id,
      riderName: winner.rider.name, updateTime: now
    }
  });
  // 骑手任务数 +1
  await db.collection('riders').doc(winner.rider._id).update({
    data: { currentTasks: _.inc(1), busy: true }
  });
  // 推送骑手
  await db.collection('riderMessages').add({
    data: {
      toRiderId: winner.rider._id,
      type: 'new_task',
      title: '新配送任务',
      content: `${o.orderNo} · ${winner.dist ? winner.dist.toFixed(1) + 'km' : ''}`,
      relatedId: res._id,
      read: false,
      createTime: now
    }
  }).catch(() => {});
  await audit.write(event, 'dispatch_assign', 'dispatch', res._id, { orderId, riderId: winner.rider._id });
  return ok({
    assigned: true, dispatchId: res._id,
    riderId: winner.rider._id, riderName: winner.rider.name
  });
}

// 抢单(骑手主动)
async function grabTask(event) {
  const { orderId } = event;
  if (!orderId) return fail('orderId 必填');
  const db = cloud.database();
  const _ = db.command;
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) return fail('订单不存在');
  if (order.data.dispatchStatus >= 1) return fail('已被抢');
  // 抢单 = 给自己派单
  const now = Date.now();
  const dispatch = {
    orderId, riderId: event._userId, riderName: event._userName || '',
    status: 1, from: {}, to: { address: (order.data.address && order.data.address.address) || '' },
    assignTime: now, fee: 5
  };
  const res = await db.collection('dispatches').add({ data: dispatch });
  // 原子操作:仅未分配的才能改
  const upd = await db.collection('orders').doc(orderId).update({
    data: {
      dispatchStatus: 1, dispatchId: res._id, riderId: event._userId,
      updateTime: now
    }
  });
  await db.collection('riders').doc(event._userId).update({
    data: { currentTasks: _.inc(1) }
  });
  return ok({ dispatchId: res._id });
}

// 状态更新(取货 / 送达)
async function updateStatus(event) {
  const { dispatchId, status, lat = 0, lng = 0 } = event;
  const db = cloud.database();
  const _ = db.command;
  if (!dispatchId) return fail('dispatchId 必填');
  const d = await db.collection('dispatches').doc(dispatchId).get();
  if (!d.data) return fail('派单不存在');
  const now = Date.now();
  const update = { updateTime: now };
  if (status === 'pickup') {
    update.status = 2;
    update.pickupTime = now;
    await db.collection('orders').doc(d.data.orderId).update({ data: { status: 2, shipTime: now } });
  } else if (status === 'arrive') {
    update.status = 3;
    update.arriveTime = now;
  } else if (status === 'complete') {
    update.status = 4;
    update.completeTime = now;
    await db.collection('orders').doc(d.data.orderId).update({ data: { status: 3, completeTime: now, receiveTime: now } });
    await db.collection('riders').doc(d.data.riderId).update({ data: { currentTasks: _.inc(-1) } });
  }
  if (lat) update.lastLat = lat;
  if (lng) update.lastLng = lng;
  await db.collection('dispatches').doc(dispatchId).update({ data: update });
  return ok({ status: update.status });
}

// 路线规划(简化:多订单串行)
async function planRoute(event) {
  const { riderId, dispatchIds = [] } = event;
  if (!riderId) return fail('riderId 必填');
  const db = cloud.database();
  const list = await db.collection('dispatches')
    .where({ _id: db.command.in(dispatchIds), riderId, status: _.in([1, 2, 3]) })
    .get();
  // 贪心:从当前位置出发,每次去最近的
  const points = list.data.map(d => ({ id: d._id, lat: d.to.lat, lng: d.to.lng, name: d.to.name }));
  // 简化:按距离起点排序
  if (points.length === 0) return ok({ route: [] });
  let cur = { lat: points[0].lat, lng: points[0].lng };
  const sorted = [];
  const remain = [...points];
  while (remain.length) {
    remain.sort((a, b) => haversine(cur.lat, cur.lng, a.lat, a.lng) - haversine(cur.lat, cur.lng, b.lat, b.lng));
    const next = remain.shift();
    sorted.push(next);
    cur = { lat: next.lat, lng: next.lng };
  }
  return ok({ route: sorted, total: sorted.length });
}

// 我的任务
async function myTasks(event) {
  const { status = -999 } = event;
  const db = cloud.database();
  const _ = db.command;
  const where = { riderId: event._userId };
  if (status !== -999) where.status = status;
  const res = await db.collection('dispatches').where(where)
    .orderBy('assignTime', 'desc')
    .limit(30)
    .get();
  return ok(res.data);
}

// 骑手签到(上线/下线)
async function riderCheckin(event) {
  const { online = true, lat = 0, lng = 0 } = event;
  const db = cloud.database();
  const now = Date.now();
  await db.collection('riders').doc(event._userId).update({
    data: { online, lat, lng, lastCheckin: now }
  });
  return ok({ online });
}

async function getRiders(event) {
  const { online = false, city = '' } = event;
  const db = cloud.database();
  const where = {};
  if (online) where.online = true;
  if (city) where.city = city;
  const res = await db.collection('riders').where(where).limit(100).get();
  return ok(res.data);
}

function calcDeliveryFee(km) {
  if (!km || km < 0) return 5;
  if (km <= 3) return 5;
  return Number((5 + (km - 3) * 1.5).toFixed(2));
}
