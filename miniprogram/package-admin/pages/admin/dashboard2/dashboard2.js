// 实时数据大屏
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');
const nav = require('../../../../utils/nav');

Page({
  data: {
    data: {
      sales: {},
      users: {},
      customerService: {},
      marketing: {},
      realtime: {},
      trend: [],
      funnel: [],
      topGoods: []
    },
    nowText: '',
    darkMode: false,
    maxAmount: 0
  },

  onLoad() {
    this.load();
    this.tickClock();
    this.timer = setInterval(() => {
      this.tickClock();
      this.load();
    }, 5000);
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  tickClock() {
    this.setData({ nowText: formatTime(new Date(), 'YYYY-MM-DD HH:mm:ss') });
  },

  toggleTheme() {
    this.setData({ darkMode: !this.data.darkMode });
  },

  async load() {
    try {
      const r = await request({ url: '/api/admin/dashboard/realtime', method: 'GET' });
      const data = r.data || r || {};
      // 预处理: 模板里不能调 Math.abs
      const dop = (data.sales && data.sales.dayOverDay) || 0;
      data.sales = data.sales || {};
      data.sales.dayOverDayText = {
        direction: dop >= 0 ? 'up' : 'down',
        arrow: dop >= 0 ? '↑' : '↓',
        abs: Math.abs(dop)
      };
      // 漏斗百分比
      if (data.funnel && data.funnel.length) {
        const max = Math.max(...data.funnel.map(f => f.value || 0), 1);
        data.funnel.forEach(f => { f.widthPercent = ((f.value || 0) / max * 100).toFixed(1); });
      }
      // 趋势最大值
      const maxAmount = Math.max(0, ...(data.trend || []).map(t => t.amount || 0));
      this.setData({ data, maxAmount });
    } catch (e) {
      console.warn('dashboard load err:', e);
    }
  },

  // 漏斗宽度 - 兼容旧引用
  getFunnelWidth(value, funnel) {
    const max = Math.max(0, ...(funnel || []).map(f => f.value || 0), 1);
    return ((value || 0) / max * 100).toFixed(1);
  }
});
