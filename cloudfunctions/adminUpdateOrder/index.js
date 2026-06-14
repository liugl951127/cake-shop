// adminUpdateOrder - 管理员更新订单状态(带状态机)
const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

// 状态流转: 1(已付款) -> 2(制作中) -> 3(配送中) -> 4(已完成)
const TRANSITIONS = {
  1: [2],
  2: [3],
  3: [4],
  4: [],
  5: [-2]
};

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { id, status, deliveryInfo } = event;
  if (!id) throw new BizError('id 必填');
  if (status === undefined) throw new BizError('status 必填');

  const newStatus = Number(status);
  const db = cloud.database();
  const order = await db.collection('orders').doc(id).get();
  if (!order.data) throw new BizError('订单不存在');
  const o = order.data;

  // 状态机校验
  const allowed = TRANSITIONS[o.status] || [];
  if (o.status !== newStatus && !allowed.includes(newStatus)) {
    throw new BizError(`订单状态 ${o.status} 不允许直接变更为 ${newStatus}`);
  }

  const update = { status: newStatus, updateTime: Date.now() };
  if (newStatus === 3 && deliveryInfo) {
    update.deliveryInfo = deliveryInfo;
    update.shipTime = Date.now();
  }
  if (newStatus === 4) update.completeTime = Date.now();
  if (newStatus === 2) update.makeTime = Date.now();

  await db.collection('orders').doc(id).update({ data: update });

  const actionMap = {
    2: 'make', 3: 'ship', 4: 'complete', 5: 'refund_complete', '-2': 'refund_complete'
  };

  await writeLog(db, {
    orderId: id, orderNo: o.orderNo, _openid: o._openid,
    action: actionMap[newStatus] || 'admin_update',
    fromStatus: o.status, toStatus: newStatus,
    operator: event._openid, operatorType: 'admin',
    remark: deliveryInfo ? `更新配送信息: ${JSON.stringify(deliveryInfo)}` : ''
  });

  return ok();
});
