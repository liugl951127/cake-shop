const { cloud, ok, BizError, auth } = require('../common/index.js');

/**
 * 支付回调(简化版)
 * 真实场景:
 *   1. 前端 wx.cloud.callFunction 调用云函数生成支付参数
 *   2. 调起 wx.requestPayment
 *   3. 支付成功后,微信回调该云函数(在 cloud.pay 模式下)
 *   4. 或前端轮询/订阅消息通知后调用本云函数确认
 *
 * 演示模式: 直接将订单置为已支付状态
 */
exports.main = auth(async (event) => {
  const { orderId, payResult } = event;
  if (!orderId) throw new BizError('orderId 必填');
  if (payResult !== 'success') throw new BizError('支付未完成');

  const db = cloud.database();
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) throw new BizError('订单不存在');
  if (order.data.status !== 0) throw new BizError('订单状态异常');

  await db.collection('orders').doc(orderId).update({
    data: {
      status: 1,  // 已付款
      payTime: Date.now(),
      updateTime: Date.now()
    }
  });
  return ok();
});
