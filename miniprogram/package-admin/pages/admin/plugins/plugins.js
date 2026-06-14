// 插件市场
const { request } = require('../../../../utils/request.js');

Page({
  data: {
    cat: '',
    plugins: []
  },

  onShow() { this.load(); },

  setCat(e) {
    this.setData({ cat: e.currentTarget.dataset.k });
    this.load();
  },

  async load() {
    try {
      const r = await request('plugin', { action: 'market', category: this.data.cat }, { loading: false, silent: true });
      this.setData({ plugins: r || [] });
    } catch (e) {}
  },

  async onToggle(e) {
    const p = e.currentTarget.dataset.p;
    const action = p.installed ? 'uninstall' : 'install';
    try {
      await request('plugin', { action, pluginKey: p.key }, { loading: false });
      wx.showToast({ title: p.installed ? '已卸载' : '已安装' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '失败', icon: 'none' });
    }
  }
});
