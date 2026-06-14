// common/subscribeMessage.js - 订阅消息发送
const cloud = require('wx-server-sdk');

const TEMPLATE_IDS = {
  // 在小程序后台 -> 订阅消息 -> 模板管理 配置
  // 下面是示例,实际使用时替换为你的真实模板 ID
  orderPay: 'YOUR_TEMPLATE_ID_PAY',         // 订单支付成功
  orderShip: 'YOUR_TEMPLATE_ID_SHIP',       // 订单发货通知
  orderComplete: 'YOUR_TEMPLATE_ID_DONE',   // 订单完成通知
  refundSuccess: 'YOUR_TEMPLATE_ID_REFUND', // 退款成功通知
  signin: 'YOUR_TEMPLATE_ID_SIGNIN',        // 签到成功
  couponExpire: 'YOUR_TEMPLATE_ID_EXPIRE'   // 优惠券即将过期
};

async function send(openid, type, data) {
  const templateId = TEMPLATE_IDS[type];
  if (!templateId || templateId.startsWith('YOUR_')) {
    console.warn(`[subscribeMessage] 模板未配置: ${type}`);
    return { ok: false, reason: 'template_not_configured' };
  }
  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId,
      data,
      miniprogramState: 'formal'  // 'developer' / 'trial' / 'formal'
    });
    return { ok: result.errcode === 0, errcode: result.errcode, errmsg: result.errmsg };
  } catch (e) {
    console.error(`[subscribeMessage] 发送失败: ${type}`, e);
    return { ok: false, error: e.message };
  }
}

module.exports = { send, TEMPLATE_IDS };
