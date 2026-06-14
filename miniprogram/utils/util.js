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

const orderStatusMap = {
  0: { text: '待付款', color: '#ff9800' },
  1: { text: '已付款', color: '#2196f3' },
  2: { text: '制作中', color: '#9c27b0' },
  3: { text: '配送中', color: '#673ab7' },
  4: { text: '已完成', color: '#4caf50' },
  '-1': { text: '已取消', color: '#999' },
  '-2': { text: '已退款', color: '#999' }
};

const formatPrice = (n) => (Number(n) || 0).toFixed(2);

module.exports = { formatTime, relativeTime, orderStatusMap, formatPrice };
