// utils/util.js
const formatTime = (date = new Date(), fmt = 'YYYY-MM-DD HH:mm:ss') => {
  const o = {
    'M+': date.getMonth() + 1,
    'D+': date.getDate(),
    'H+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds()
  };
  let r = fmt;
  if (/(Y+)/.test(r)) r = r.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
  for (const k in o) {
    if (new RegExp(`(${k})`).test(r)) {
      r = r.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
    }
  }
  return r;
};

const relativeTime = (date) => {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  return formatTime(date, 'YYYY-MM-DD');
};

// 完整订单状态机
const orderStatusMap = {
  0:  { text: '待付款', color: '#ff9800', desc: '请在 30 分钟内完成支付' },
  1:  { text: '已付款', color: '#2196f3', desc: '商家准备中' },
  2:  { text: '制作中', color: '#9c27b0', desc: '用心烘焙中' },
  3:  { text: '配送中', color: '#673ab7', desc: '骑手正在派送' },
  4:  { text: '已完成', color: '#4caf50', desc: '订单已完成' },
  5:  { text: '退款中', color: '#ff5722', desc: '退款处理中' },
  '-1': { text: '已取消', color: '#999', desc: '订单已取消' },
  '-2': { text: '已退款', color: '#999', desc: '退款已到账' }
};

const formatPrice = (n) => (Number(n) || 0).toFixed(2);

// 倒计时格式化
const formatCountdown = (ms) => {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

module.exports = { formatTime, relativeTime, orderStatusMap, formatPrice, formatCountdown };
