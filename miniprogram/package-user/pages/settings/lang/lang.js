const { getLang, setLang, getLangs } = require('../../../../utils/i18n.js');

Page({
  data: { langs: [], current: 'zh-CN', currentName: '简体中文' },

  onLoad() {
    const langs = getLangs();
    const current = getLang();
    this.setData({
      langs,
      current,
      currentName: (langs.find(l => l.code === current) || {}).name || '简体中文'
    });
  },

  selectLang(e) {
    const code = e.currentTarget.dataset.code;
    setLang(code);
    wx.setStorageSync('app_language', code);
    const langs = getLangs();
    this.setData({
      current: code,
      currentName: (langs.find(l => l.code === code) || {}).name
    });
    wx.showToast({ title: '已切换', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
