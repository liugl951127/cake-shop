// autoCloseGroups - 拼团失败自动处理
// Cron: 0 */10 * * * *
const { cloud, ok } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const res = await db.collection('groups').where({
    status: 1,
    expireTime: _.lt(now)
  }).limit(100).get();

  let closed = 0;
  for (const g of res.data) {
    // 标团失败
    await db.collection('groups').doc(g._id).update({
      data: { status: 3, updateTime: now }
    });
    // 关联订单:已付款的进入退款流程,未付款的关闭
    for (const m of g.members) {
      if (!m.orderId) continue;
      const order = await db.collection('orders').doc(m.orderId).get().catch(() => null);
      if (!order || !order.data) continue;
      const o = order.data;
      if (o.status === 0) {
        // 未付款,关闭
        await db.collection('orders').doc(o._id).update({
          data: { status: -1, cancelReason: '拼团失败', groupStatus: 'fail', updateTime: now }
        });
        // 恢复库存
        for (const it of o.items) {
          await db.collection('goods').doc(it._id).update({
            data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
          }).catch(() => {});
        }
        await writeLog(db, {
          orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
          action: 'group_fail', fromStatus: 0, toStatus: -1,
          operator: 'system', operatorType: 'system',
          remark: '拼团失败,自动关闭订单'
        });
      } else if (o.status >= 1 && o.status < 4) {
        // 已付款,进入退款流程
        await db.collection('orders').doc(o._id).update({
          data: { status: 5, refundStatus: 1, refundReason: '拼团失败自动退款', groupStatus: 'fail', updateTime: now }
        });
        await writeLog(db, {
          orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
          action: 'group_fail', fromStatus: o.status, toStatus: 5,
          operator: 'system', operatorType: 'system',
          remark: '拼团失败,自动退款'
        });
      }
    }
    closed++;
  }
  return ok({ closed });
};
