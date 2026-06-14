// common/orderLog.js - 订单操作日志
// 状态机: -2=已退款 -1=已取消 0=待付款 1=已付款 2=配送中 3=待收货 4=已完成 -3=风控拦截
const { logger } = require('./index.js');

const ACTIONS = {
  CREATE: 'create',
  PAY: 'pay',
  CANCEL: 'cancel',
  CONFIRM: 'confirm',
  SHIP: 'ship',
  DELIVER: 'deliver',
  COMPLETE: 'complete',
  REFUND: 'refund',
  REFUND_REJECT: 'refund_reject',
  RISK_REJECT: 'risk_reject'
};

const STATUS_TEXT = {
  '-3': '风控拦截',
  '-2': '已退款',
  '-1': '已取消',
  0: '待付款',
  1: '已付款',
  2: '配送中',
  3: '待收货',
  4: '已完成'
};

/**
 * 写订单日志(失败不影响主业务)
 */
async function writeLog(db, log) {
  try {
    await db.collection('orderLogs').add({
      data: {
        orderId: log.orderId,
        orderNo: log.orderNo || '',
        _openid: log._openid || '',
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        operator: log.operator || '',
        operatorType: log.operatorType || 'user',
        remark: log.remark || '',
        createTime: Date.now()
      }
    });
  } catch (e) {
    logger.error('writeLog 失败', e, {
      orderId: log.orderId,
      action: log.action
    });
  }
}

module.exports = { writeLog, ACTIONS, STATUS_TEXT };
