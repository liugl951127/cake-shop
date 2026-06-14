// common/orderLog.js - 订单操作日志
async function writeLog(db, log) {
  try {
    await db.collection('orderLogs').add({
      data: {
        orderId: log.orderId,
        orderNo: log.orderNo || '',
        _openid: log._openid || '',
        action: log.action,           // create / pay / cancel / confirm / ship / deliver / complete / refund
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        operator: log.operator || '', // openid 或 'system' 或 'admin'
        operatorType: log.operatorType || 'user', // user / admin / system
        remark: log.remark || '',
        createTime: Date.now()
      }
    });
  } catch (e) {
    console.error('writeLog 失败', e);
  }
}

module.exports = { writeLog };
