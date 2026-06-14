// common/pay.js - 微信支付工具
// 重要:所有金额单位都是 分
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

// 商户号配置(从云函数环境变量读取)
// 部署时设置环境变量: MCH_ID, MCH_KEY, MCH_SERIAL_NO(若用v3)
const MCH_ID = process.env.MCH_ID || 'YOUR_MCH_ID';
const MCH_KEY = process.env.MCH_KEY || 'YOUR_MCH_KEY_32_CHARS_1234567890';
const NOTIFY_URL = process.env.NOTIFY_URL || ''; // 支付回调地址
const BODY = '甜心蛋糕商城';

/**
 * 生成商户订单号(32 位以内)
 */
function genOutTradeNo(prefix = 'CAKE') {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `${prefix}${stamp}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * MD5 签名(v2 版 API)
 */
function signMD5(params, key) {
  // 1. 去除空值 + 签名本身
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  const stringA = `${sorted}&key=${key}`;
  return crypto.createHash('md5').update(stringA).digest('hex').toUpperCase();
}

/**
 * 验签 MD5
 */
function verifyMD5(params, key) {
  const recvSign = params.sign;
  if (!recvSign) return false;
  const calcSign = signMD5(params, key);
  return recvSign === calcSign;
}

/**
 * 统一下单(使用云开发 cloudPay)
 * 返回前端调起支付需要的参数
 */
async function unifiedOrder({ outTradeNo, totalFee, openid, body = BODY, attach = '', spbillCreateIp = '127.0.0.1' }) {
  try {
    const result = await cloud.cloudPay.unifiedOrder({
      body,
      outTradeNo,
      spbillCreateIp,
      subMchId: '', // 子商户号(服务商模式)
      totalFee, // 单位:分
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payCallback', // 支付回调云函数
      functionName2: '', // 退款回调(可选)
      nonceStr: Math.random().toString(36).substr(2, 16),
      tradeType: 'JSAPI',
      openid,
      attach
    });

    return {
      success: true,
      payment: result.payment,
      outTradeNo
    };
  } catch (err) {
    console.error('unifiedOrder 失败:', err);
    return {
      success: false,
      error: err.message || '统一下单失败',
      outTradeNo
    };
  }
}

/**
 * 退款申请
 * 真实环境需配合证书 + v3 接口
 */
async function refund({ outTradeNo, outRefundNo, totalFee, refundFee, reason = '用户申请退款' }) {
  try {
    const result = await cloud.cloudPay.refund({
      outTradeNo,
      outRefundNo,
      totalFee,
      refundFee,
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payCallback',
      subMchId: ''
    });
    return { success: true, result };
  } catch (err) {
    console.error('refund 失败:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 生成非重复商户订单号(防重)
 */
function genUniqueOutTradeNo() {
  return genOutTradeNo();
}

module.exports = {
  signMD5, verifyMD5,
  unifiedOrder, refund,
  genOutTradeNo, genUniqueOutTradeNo
};
