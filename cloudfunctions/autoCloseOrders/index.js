// autoCloseOrders - 定时任务:30 分钟未支付自动关单
// 配置:云开发控制台 -> 云函数 -> autoCloseOrders -> 定时触发器
// Cron: 0 */5 * * * * (每 5 分钟执行一次)
const { cloud, ok } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  // 查所有超时未支付的订单
  const res = await db.collection('orders').where({
    status: 0,
    expireTime: _.lt(now)
  }).limit(100).get();

  if (res.data.length === 0) return ok({ closed: 0 });

  let closed = 0;
  for (const o of res.data) {
    try {
      // 恢复库存
      for (const it of o.items) {
        await db.collection('goods').doc(it._id).update({
          data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
        }).catch(() => {});
      }
      // 关单
      await db.collection('orders').doc(o._id).update({
        data: { status: -1, cancelReason: '超时未支付,系统自动关闭', updateTime: now }
      });
      await writeLog(db, {
        orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
        action: 'auto_close', fromStatus: 0, toStatus: -1,
        operator: 'system', operatorType: 'system',
        remark: '超时未支付,系统自动关闭订单'
      });
      closed++;
    } catch (e) {
      console.error('关单失败:', o._id, e);
    }
  }

  return ok({ closed, total: res.data.length });
};
