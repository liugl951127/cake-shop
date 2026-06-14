// app.js
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
