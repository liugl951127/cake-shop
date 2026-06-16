// utils/i18n.js - 多语言支持
// 支持语言: 简体中文 / English / 粤语
const STORAGE_KEY = 'app_language';

// 语言包
const LANGS = {
  'zh-CN': {
    name: '简体中文',
    home: '首页', category: '分类', cart: '购物车', order: '订单', my: '我的',
    search: '搜索商品', addCart: '加入购物车', buyNow: '立即购买',
    login: '登录', logout: '退出登录', member: '会员', coupon: '优惠券',
    address: '地址', favorite: '收藏', chat: '客服', help: '帮助',
    submitOrder: '提交订单', pay: '支付', cancel: '取消', confirm: '确认',
    empty: '暂无数据', loading: '加载中...', noMore: '没有更多了',
    language: '语言', settings: '设置', about: '关于', agreement: '用户协议',
    privacy: '隐私政策', faq: '常见问题', notice: '公告',
    aiMatch: '智能客服', humanService: '人工客服', online: '在线', offline: '离线',
    rating: '评分', responseTime: '响应时间', workload: '工作量',
    sales: '已售', stock: '库存', price: '价格', total: '合计',
    send: '发送', input: '输入消息', reply: '回复',
    sessionEnd: '会话已结束', reconnecting: '正在重连...',
    seconds: '秒', minutes: '分钟', hours: '小时', days: '天',
    today: '今天', yesterday: '昨天', tomorrow: '明天'
  },
  'en': {
    name: 'English',
    home: 'Home', category: 'Category', cart: 'Cart', order: 'Orders', my: 'Mine',
    search: 'Search', addCart: 'Add to Cart', buyNow: 'Buy Now',
    login: 'Login', logout: 'Logout', member: 'Member', coupon: 'Coupon',
    address: 'Address', favorite: 'Favorite', chat: 'Support', help: 'Help',
    submitOrder: 'Submit', pay: 'Pay', cancel: 'Cancel', confirm: 'Confirm',
    empty: 'No data', loading: 'Loading...', noMore: 'No more',
    language: 'Language', settings: 'Settings', about: 'About', agreement: 'Agreement',
    privacy: 'Privacy', faq: 'FAQ', notice: 'Notice',
    aiMatch: 'AI Support', humanService: 'Human', online: 'Online', offline: 'Offline',
    rating: 'Rating', responseTime: 'Response', workload: 'Workload',
    sales: 'Sold', stock: 'Stock', price: 'Price', total: 'Total',
    send: 'Send', input: 'Type a message', reply: 'Reply',
    sessionEnd: 'Session ended', reconnecting: 'Reconnecting...',
    seconds: 's', minutes: 'm', hours: 'h', days: 'd',
    today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow'
  },
  'zh-HK': {
    name: '繁體粵語',
    home: '主頁', category: '分類', cart: '購物車', order: '訂單', my: '我的',
    search: '搜尋商品', addCart: '加入購物車', buyNow: '立即購買',
    login: '登入', logout: '登出', member: '會員', coupon: '優惠券',
    address: '地址', favorite: '收藏', chat: '客服', help: '幫助',
    submitOrder: '提交訂單', pay: '付款', cancel: '取消', confirm: '確認',
    empty: '暫無數據', loading: '載入中...', noMore: '沒有更多',
    language: '語言', settings: '設置', about: '關於', agreement: '用戶協議',
    privacy: '隱私政策', faq: '常見問題', notice: '公告',
    aiMatch: '智能客服', humanService: '人工客服', online: '在線', offline: '離線',
    rating: '評分', responseTime: '響應時間', workload: '工作量',
    sales: '已售', stock: '庫存', price: '價格', total: '合計',
    send: '發送', input: '輸入訊息', reply: '回覆',
    sessionEnd: '會話已結束', reconnecting: '重新連接中...',
    seconds: '秒', minutes: '分鐘', hours: '小時', days: '天',
    today: '今天', yesterday: '昨天', tomorrow: '明天'
  }
};

let currentLang = 'zh-CN';
const listeners = [];

function getLang() {
  if (!currentLang) {
    currentLang = wx.getStorageSync(STORAGE_KEY) || 'zh-CN';
  }
  return currentLang;
}

function setLang(lang) {
  if (!LANGS[lang]) lang = 'zh-CN';
  currentLang = lang;
  wx.setStorageSync(STORAGE_KEY, lang);
  listeners.forEach(fn => fn(lang));
}

function t(key) {
  const lang = getLang();
  return (LANGS[lang] && LANGS[lang][key]) || (LANGS['zh-CN'][key]) || key;
}

function getLangs() {
  return Object.entries(LANGS).map(([code, l]) => ({ code, name: l.name }));
}

function onChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i > -1) listeners.splice(i, 1);
  };
}

// 简易全局刷新
function refreshAll() {
  const pages = getCurrentPages();
  pages.forEach(p => {
    if (p.onLangChange) p.onLangChange();
    if (p.onShow) p.onShow();
  });
}

module.exports = {
  getLang, setLang, t, getLangs, onChange, refreshAll,
  LANGS
};
