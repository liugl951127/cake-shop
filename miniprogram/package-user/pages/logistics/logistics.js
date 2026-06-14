const { request } = require('../../utils/request.js');
const { formatTime } = require('../../utils/util.js');

Page({
  data: { info: {}, trace: null, traceList: [], loading: false },

  onLoad(options) {
    this.setData({
      info: { company: options.company || '', number: options.number || '' }
    });
    if (this.data.info.company && this.data.info.number) {
      this.query();
    }
  },

  async query() {
    this.setData({ loading: true });
    try {
      const r = await request('queryLogistics', {
        company: this.data.info.company,
        number: this.data.info.number
      });
      const traceList = (r.data || []).map(t => ({
        ...t,
        timeText: formatTime(new Date(t.time))
      }));
      this.setData({ trace: r, traceList });
    } catch (e) {}
    this.setData({ loading: false });
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.info.number });
  }
});
