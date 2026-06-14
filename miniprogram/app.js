// app.js
App({
  globalData: {
    userInfo: null,
    openid: null,
    cartCount: 0,
    version: '1.0.0',
    // ===== 后期只需要改这里的 appid =====
    // 实际 appid 写在 project.config.json 的 appid 字段
    // 这里只存云开发环境 id，云开发开通后填入
    cloudEnvId: 'your-cloud-env-id',
    isAdmin: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // ★★★ 替换成你自己的云开发环境 ID（云开发控制台查看）★★★
        env: this.globalData.cloudEnvId,
        traceUser: true
      });
    }
    this.checkUpdate();
  },

  onShow() {
    this.refreshCartBadge();
  },

  // 检测小程序版本更新
  checkUpdate() {
    if (wx.getUpdateManager) {
      const updateManager = wx.getUpdateManager();
      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好,是否重启应用?',
          success: (res) => { if (res.confirm) updateManager.applyUpdate(); }
        });
      });
    }
  },

  // 刷新购物车角标
  refreshCartBadge() {
    const cart = wx.getStorageSync('cart') || [];
    const count = cart.reduce((s, i) => s + (i.count || 0), 0);
    this.globalData.cartCount = count;
    if (count > 0) wx.setTabBarBadge({ index: 2, text: String(count) }).catch(() => {});
    else wx.removeTabBarBadge({ index: 2 }).catch(() => {});
  }
});
