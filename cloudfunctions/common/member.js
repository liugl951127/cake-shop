// common/member.js - 会员等级规则
// 等级阈值:成长值 (累计消费金额 1:1)
const LEVELS = [
  { level: 0, name: '普通会员', icon: '🌱', min: 0,    max: 99,   discount: 1.0,  desc: '注册即享' },
  { level: 1, name: '银卡会员', icon: '🥈', min: 100,  max: 499,  discount: 0.98, desc: '98 折优惠' },
  { level: 2, name: '金卡会员', icon: '🥇', min: 500,  max: 1999, discount: 0.95, desc: '95 折优惠' },
  { level: 3, name: '钻石会员', icon: '💎', min: 2000, max: 99999,discount: 0.9,  desc: '9 折优惠 + 专属客服' }
];

// 积分规则:消费 1 元 = 1 积分;签到 1 次 = 5 积分
const POINTS_PER_YUAN = 1;
const SIGNIN_POINTS = 5;

function getLevel(exp) {
  for (const lv of LEVELS) {
    if (exp >= lv.min && exp <= lv.max) return lv;
  }
  return LEVELS[LEVELS.length - 1];
}

function getNextLevel(exp) {
  const cur = getLevel(exp);
  return LEVELS.find(lv => lv.level === cur.level + 1) || null;
}

function calcDiscount(level, price) {
  const lv = LEVELS.find(l => l.level === level) || LEVELS[0];
  return Number((price * lv.discount).toFixed(2));
}

// 计算消费后的成长值变化
function addGrowth(userExp, amount) {
  return userExp + Math.floor(amount);
}

// 计算消费后的积分变化
function addPoints(userPoints, amount) {
  return userPoints + Math.floor(amount * POINTS_PER_YUAN);
}

module.exports = {
  LEVELS, POINTS_PER_YUAN, SIGNIN_POINTS,
  getLevel, getNextLevel, calcDiscount,
  addGrowth, addPoints
};
