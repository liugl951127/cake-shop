// 实时数据大屏
const { request } = require('../../../../utils/request.js');
const { formatTime } = require('../../../../utils/util.js');

Page({
  data: {
    nowText: '',
    data: {
      sales: {}, users: {}, trend: [], funnel: [],
      topGoods: [], realtime: { last5minOrders: [] },
      customerService: {}, marketing: {}
    },
    maxAmount: 1,
    darkMode: true
  },

  _timer: null,

  onLoad() {
    this.load();
    this._tick();
    this._timer = setInterval(() => {
      this.load();
      this._tick();
    }, 60000);  // 每分钟刷
  },

  onUnload() { if (this._timer) clearInterval(this._timer); },

  _tick() {
    this.setData({ nowText: formatTime(Date.now()).slice(11) });
  },

  async load() {
    try {
      const r = await request('realtimeDashboard', {}, { loading: false, silent: true });
      // 实时订单时间格式化
      r.realtime.last5minOrders = (r.realtime.last5minOrders || []).map(o => ({
        ...o,
        timeText: formatTime(o.createTime).slice(11, 16)
      }));
      const max = Math.max(...(r.trend.map(t => t.amount) || [1]));
      this.setData({ data: r, maxAmount: max || 1 });
    } catch (e) {}
  },

  getFunnelWidth(value, funnel) {
    if (!funnel || !funnel.length) return 0;
    const max = funnel[0].value || 1;
    return Math.max(5, (value / max) * 100);
  },

  toggleTheme() {
    this.setData({ darkMode: !this.data.darkMode });
  }
});
