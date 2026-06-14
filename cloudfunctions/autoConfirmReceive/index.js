// autoConfirmReceive - 配送 7 天后自动确认收货
// 配合定时触发器
const { cloud, ok } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

const AUTO_CONFIRM_DAYS = 7;
const AUTO_CONFIRM_MS = AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000;

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const cutoff = Date.now() - AUTO_CONFIRM_MS;

  const res = await db.collection('orders').where({
    status: 3,
    shipTime: _.lt(cutoff)
  }).limit(100).get();

  if (res.data.length === 0) return ok({ confirmed: 0 });

  let confirmed = 0;
  for (const o of res.data) {
    try {
      await db.collection('orders').doc(o._id).update({
        data: { status: 4, completeTime: Date.now(), updateTime: Date.now() }
      });
      await writeLog(db, {
        orderId: o._id, orderNo: o.orderNo, _openid: o._openid,
        action: 'auto_confirm', fromStatus: 3, toStatus: 4,
        operator: 'system', operatorType: 'system',
        remark: `发货 ${AUTO_CONFIRM_DAYS} 天后系统自动确认收货`
      });
      confirmed++;
    } catch (e) {}
  }
  return ok({ confirmed, total: res.data.length });
};
