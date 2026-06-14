// common/config.js - 统一配置中心
// 用法:
//   const { config } = require('../common/config.js');
//   const url = config.WX_PAY_URL;
//   config.isProd 判断环境
//
// 所有云函数的 process.env.xxx 集中到这
const ENV = (process.env.NODE_ENV || 'development').toLowerCase();

const config = {
  ENV,
  isProd: ENV === 'production',
  isTest: ENV === 'test',
  isDev: ENV === 'development',

  // 业务配置
  COMMISSION_RATE: 0.05,       // 平台佣金 5%
  MIN_WITHDRAW: 100,           // 最低提现
  MAX_WITHDRAW: 50000,         // 单次最高
  WITHDRAW_FEE: 0,             // 提现手续费率

  // 风控阈值
  RISK: {
    PAY:        { reject: 90, manual: 70, verify: 40 },
    WITHDRAW:   { reject: 90, manual: 70, verify: 50 },
    LOGIN:      { reject: 80, manual: 60, verify: 30 },
    REGISTER:   { reject: 80, manual: 50, verify: 30 },
    HIGHORDER:  { reject: 90, manual: 60, verify: 40 }
  },

  // 缓存 TTL
  CACHE_TTL: {
    SHORT: 60,           // 1 分钟
    MIDDLE: 300,         // 5 分钟
    LONG: 1800,          // 30 分钟
    HOUR: 3600,          // 1 小时
    DAY: 86400           // 1 天
  },

  // 外部 API
  WX_PAY_URL: process.env.WX_PAY_URL || '',
  WX_PAY_KEY: process.env.WX_PAY_KEY || '',
  WX_PAY_MCH_ID: process.env.WX_PAY_MCH_ID || '',
  WX_PAY_NOTIFY_URL: process.env.WX_PAY_NOTIFY_URL || '',

  TX_MAP_KEY: process.env.TX_MAP_KEY || '',
  VERIFY_API_URL: process.env.VERIFY_API_URL || '',
  LIVENESS_API_URL: process.env.LIVENESS_API_URL || '',
  BANK_VERIFY_API: process.env.BANK_VERIFY_API || '',
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  LLM_MODEL: process.env.LLM_MODEL || 'gpt-3.5-turbo',

  // 安全
  SALT: process.env.SALT || 'cake_shop_2024',
  TOKEN_SECRET: process.env.TOKEN_SECRET || 'default_jwt_secret_2024',
  TOKEN_TTL: 7 * 24 * 60 * 60 * 1000,  // 7 天

  // 订单
  ORDER_EXPIRE: 30 * 60 * 1000,  // 30 分钟
  ORDER_AUTO_CONFIRM: 7 * 86400000,  // 7 天自动确认

  // 短信
  SMS_CODE_TTL: 5 * 60 * 1000,  // 5 分钟

  // 业务消息模板
  BIRTHDAY_TEMPLATE_ID: process.env.BIRTHDAY_TEMPLATE_ID || 'birthday_reminder'
};

// 调试: 打印启动配置
if (config.isDev) {
  console.log(`[config] ENV=${ENV} MCH=${config.WX_PAY_MCH_ID ? 'OK' : 'NO'} SMS_KEY=${!!config.LLM_API_KEY}`);
}

module.exports = { config };
