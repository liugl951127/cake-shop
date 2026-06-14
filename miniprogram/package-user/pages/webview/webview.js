Page({
  onLoad(options) {
    this.setData({ url: decodeURIComponent(options.url) || '' });
    if (options.title) wx.setNavigationBarTitle({ title: options.title });
  }
});
