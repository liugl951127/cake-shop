// components/rich-message/index.js
// 富文本消息渲染组件
// props:
//   nodes      富文本节点数组
//   content    退化文本(当 nodes 为空时)
//   className  容器额外 class
//   selectable 是否可选中

Component({
  properties: {
    nodes: { type: Array, value: [] },
    content: { type: String, value: '' },
    className: { type: String, value: '' },
    selectable: { type: Boolean, value: true }
  },

  data: {
    imgList: []
  },

  observers: {
    'nodes': function (nodes) {
      // 提取所有图片 URL,用于 preview
      if (Array.isArray(nodes)) {
        const list = nodes
          .filter(n => n && n.t === 'img' && typeof n.v === 'string')
          .map(n => n.v);
        this.setData({ imgList: list });
      }
    }
  },

  methods: {
    onTapLink(e) {
      const href = e.currentTarget.dataset.href;
      if (!href) return;
      // 客服富文本里的链接 -> 走 webview
      wx.navigateTo({
        url: '/pages/webview/webview?url=' + encodeURIComponent(href),
        fail: () => {
          // 兜底
          wx.setStorageSync('__external_href', href);
        }
      });
    },
    onPreviewImage(e) {
      const url = e.currentTarget.dataset.url;
      const list = e.currentTarget.dataset.list || [url];
      wx.previewImage({ current: url, urls: list });
    },
    onTapProduct(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
    },
    onTapOrder(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({ url: '/package-order/pages/order/detail/detail?id=' + id });
    }
  }
});
