// app.js
require('./utils/cloud-shim.js');   // ★ v36.1 静默拦截 wx.cloud.callFunction
const tracker = require('./utils/tracker.js');
const monitor = require('./utils/monitor.js');
const device = require('./utils/device.js');
const offlineQueue = require('./utils/offlineQueue.js');
const authz = require('./utils/auth.js');

App({
  globalData: {
    userInfo: null,
    token: '',
    openid: null,
    isAdmin: false,
    cartCount: 0,
    version: '1.0.0',
    lang: 'zh-CN',
    cloudEnvId: 'your-cloud-env-id'  // ★ 改这里 ★
  },

  onLaunch() {
    if (!wx.cloud) return;
    wx.cloud.init({ env: this.globalData.cloudEnvId, traceUser: true });
    // 加载语言设置
    const lang = wx.getStorageSync('app_language') || 'zh-CN';
    this.globalData.lang = lang;
    this.checkUpdate();
    this.silentLogin();
    // 初始化行为埋点 SDK
    tracker.init({ app: this });
    tracker.login('wechat-silent');
    // 初始化性能监控 + 异常上报
    monitor.init({ app: this });
    // 初始化离线操作队列
    offlineQueue.init();
    // 注册设备能力(云端记为设备信息,给兼容表用)
    const dev = device.getDeviceInfo();
    wx.cloud.callFunction({
      name: 'registryDevice',
      data: { deviceInfo: dev, clientId: wx.getStorageSync('__offline_client_id__') || '' }
    }).catch(() => {});
    this.globalData.device = dev;
    // 初始化授权管理 SDK(持久化 grants + 监听 onShow 刷新)
    authz.init({ app: this });
  },

  onShow() {
    this.refreshCartBadge();
    // 广播 onAppShow 给所有页面
    const pages = getCurrentPages();
    pages.forEach(p => { if (p.onAppShow) p.onAppShow(); });
  },

  onHide() {
    // 广播 onAppHide(杀进程 / 切后台)
    const pages = getCurrentPages();
    pages.forEach(p => { if (p.onAppHide) p.onAppHide(); });
  },

  async silentLogin() {
    try {
      const { login } = require('./utils/auth.js');
      await login(false);
    } catch (e) {}
  },

  checkUpdate() {
    if (!wx.getUpdateManager) return;
    const updateManager = wx.getUpdateManager();
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好,是否重启应用?',
        success: (res) => { if (res.confirm) updateManager.applyUpdate(); }
      });
    });
  },

  refreshCartBadge() {
    const cart = wx.getStorageSync('cart') || [];
    const count = cart.reduce((s, i) => s + (i.count || 0), 0);
    this.globalData.cartCount = count;
    if (count > 0) wx.setTabBarBadge({ index: 2, text: String(count) }).catch(() => {});
    else wx.removeTabBarBadge({ index: 2 }).catch(() => {});
  }
});
