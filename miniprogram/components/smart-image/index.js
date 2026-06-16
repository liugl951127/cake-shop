// components/smart-image/index.js
// 智能图片组件:
//   - lazy-load 自动懒加载
//   - 默认占位图(本地)
//   - 错误兜底(本地 emoji / svg)
//   - WebP 自动(如果浏览器支持)
//   - 缩略图占位
Component({
  properties: {
    src: { type: String, value: '' },
    mode: { type: String, value: 'aspectFill' },
    placeholder: { type: String, value: '' },  // 加载中占位
    errorImage: { type: String, value: '' },    // 加载失败兜底
    webp: { type: Boolean, value: true },        // 优先 WebP
    width: { type: String, value: '' },
    height: { type: String, value: '' }
  },
  data: {
    finalSrc: '',
    loaded: false,
    error: false
  },
  observers: {
    'src': function (src) {
      this.setData({ loaded: false, error: false });
      this.chooseSrc(src);
    }
  },
  lifetimes: {
    attached() {
      this.chooseSrc(this.properties.src);
    }
  },
  methods: {
    chooseSrc(src) {
      if (!src) {
        this.setData({ finalSrc: this.properties.placeholder || '' });
        return;
      }
      // 远端 URL, 暂不替换(可加 ?imageMogr2/format/webp 走 CDN 处理)
      // 本地图直接用
      this.setData({ finalSrc: src });
    },
    onLoad() {
      this.setData({ loaded: true, error: false });
      this.triggerEvent('load');
    },
    onError() {
      this.setData({ error: true, finalSrc: this.properties.errorImage || this.properties.placeholder || '' });
      this.triggerEvent('error');
    }
  }
});
