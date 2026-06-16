// custom-tab-bar/index.js
// 自定义 tabBar (用 emoji + CSS, 不依赖 PNG)
//  - 必须配合 app.json 的 tabBar.custom = true
//  - 节省 10 个 tabbar PNG (3.3KB)
Component({
  data: {
    selected: 0,
    color: '#94a3b8',
    selectedColor: '#6366f1',
    list: [
      { pagePath: 'pages/index/index',     text: '首页',   emoji: '🏠', emojiActive: '🏠' },
      { pagePath: 'pages/goods/goods',     text: '分类',   emoji: '🧁', emojiActive: '🧁' },
      { pagePath: 'pages/cart/cart',       text: '购物车', emoji: '🛒', emojiActive: '🛒' },
      { pagePath: 'pages/order/list/list', text: '订单',   emoji: '📋', emojiActive: '📋' },
      { pagePath: 'pages/my/my',           text: '我的',   emoji: '👤', emojiActive: '👤' }
    ]
  },
  attached() {
    // 同步当前 tab
    const pages = getCurrentPages();
    if (pages.length) {
      const cur = pages[pages.length - 1];
      const idx = this.data.list.findIndex(t => t.pagePath === '/' + cur.route);
      if (idx >= 0) this.setData({ selected: idx });
    }
  },
  methods: {
    onSwitch(e) {
      const idx = e.currentTarget.dataset.idx;
      const item = this.data.list[idx];
      if (idx === this.data.selected) return;
      wx.switchTab({ url: item.pagePath, fail: (err) => {
        console.warn('switchTab fail', err);
      }});
    }
  }
});
