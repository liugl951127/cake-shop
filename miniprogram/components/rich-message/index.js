// miniprogram/components/rich-message/index.js
// 富文本消息渲染 + 交互
//   - 文本/格式/链接/图片/视频/音频/文件/位置/地图
//   - 点击图片/视频/文件: 先走授权 SDK 拿 token,再 preview/download
//   - 点击位置: 校验 + wx.openLocation 打开地图
//   - 复制文本 / 分享商品 / 跳转订单
const authz = require('../../utils/auth.js');
const monitor = require('../../utils/monitor.js');

Component({
  properties: {
    rich: {
      type: Array,
      value: []    // 富文本节点数组
    },
    sessionId: { type: String, value: '' },
    messageId: { type: String, value: '' },
    selfSide: { type: Boolean, value: false }
  },
  data: {
    nodes: [],
    expanded: false
  },
  lifetimes: {
    attached() {
      this.format();
    }
  },
  observers: {
    'rich': function (rich) {
      this.format();
    }
  },
  methods: {
    format() {
      const nodes = (this.properties.rich || []).map(n => {
        const node = Object.assign({}, n);
        // 预处理: 模板里不能调 .toFixed(),在 JS 里预先算好
        if (node.t === 'file' && node.a && typeof node.a.size === 'number') {
          const sz = node.a.size;
          if (sz < 1024) {
            node.a.sizeText = sz + ' B';
          } else if (sz < 1024 * 1024) {
            node.a.sizeText = (sz / 1024).toFixed(1) + ' KB';
          } else if (sz < 1024 * 1024 * 1024) {
            node.a.sizeText = (sz / 1024 / 1024).toFixed(1) + ' MB';
          } else {
            node.a.sizeText = (sz / 1024 / 1024 / 1024).toFixed(2) + ' GB';
          }
        }
        return node;
      });
      this.setData({ nodes });
    },

    // 点击链接
    onLink(e) {
      const { href, title } = e.currentTarget.dataset || {};
      if (!href) return;
      if (typeof this.triggerEvent === 'function') {
        this.triggerEvent('link', { href, title });
      }
      if (title === 'order') return;  // 跳订单由父组件处理
      if (title === 'product') return;
      wx.navigateTo({
        url: '/pages/webview/index?url=' + encodeURIComponent(href),
        fail: (err) => {
          wx.setClipboardData({ data: href });
        }
      });
    },

    // 复制文本
    onCopy(e) {
      const { text } = e.currentTarget.dataset || {};
      if (!text) return;
      wx.setClipboardData({
        data: text,
        success: () => {
          wx.showToast({ title: '已复制', icon: 'none' });
          if (typeof monitor !== 'undefined') {
            monitor.event('rich_copy', { messageId: this.properties.messageId });
          }
        }
      });
    },

    // 点击图片: 需要相册权限 + 资源 token
    onImage(e) {
      const { url, urls } = e.currentTarget.dataset || {};
      this.openMedia({
        type: 'image',
        fileId: url,
        urls: urls || [url]
      });
    },

    // 点击视频: 需要相册权限 + 资源 token
    onVideo(e) {
      const { url, thumb } = e.currentTarget.dataset || {};
      this.openMedia({
        type: 'video',
        fileId: url,
        thumb
      });
    },

    // 点击音频/语音: 需要麦克风/文件权限
    onAudio(e) {
      const { url, duration, type } = e.currentTarget.dataset || {};
      this.openMedia({
        type: type === 'voice' ? 'voice' : 'audio',
        fileId: url,
        duration
      });
    },

    // 点击文件: 需要文件权限
    onFile(e) {
      const { url, name, size, mime } = e.currentTarget.dataset || {};
      this.openFile({ fileId: url, name, size, mime });
    },

    // 点击位置: 校验 + 打开地图
    onLocation(e) {
      const { latitude, longitude, name, address, accuracy, scale } = e.currentTarget.dataset || {};
      this.openLocation({ latitude, longitude, name, address, accuracy, scale });
    },

    // 打开媒体(图/视频)
    async openMedia(opts) {
      try {
        const r = await this.requireScopesFor(opts.type);
        if (!r.allGranted) {
          return wx.showToast({ title: '未授权', icon: 'none' });
        }
        if (opts.type === 'image') {
          wx.previewImage({
            current: opts.fileId,
            urls: opts.urls
          });
        } else if (opts.type === 'video') {
          // 视频 - 走 downloadFile + 临时授权
          const dl = await authz.downloadFile(opts.fileId, { type: 'video' });
          if (dl && dl.tempFilePath) {
            // 简单播放: 复制到 wx 内可访问
            wx.openVideoEditor && wx.openVideoEditor({
              filePath: dl.tempFilePath,
              fail: () => {
                // 不支持 editor - 直接给下载链接
                wx.showModal({
                  title: '视频已就绪',
                  content: '视频已临时下载,可保存到相册',
                  confirmText: '保存',
                  success: (m) => {
                    if (m.confirm) {
                      wx.saveVideoToPhotosAlbum({
                        filePath: dl.tempFilePath,
                        success: () => wx.showToast({ title: '已保存' }),
                        fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
                      });
                    }
                  }
                });
              }
            });
          }
        } else {
          // 音频/语音: 调内部音频
          const dl = await authz.downloadFile(opts.fileId, { type: 'audio' });
          if (dl && dl.tempFilePath) {
            const audioCtx = wx.createInnerAudioContext();
            audioCtx.src = dl.tempFilePath;
            audioCtx.play();
            if (typeof monitor !== 'undefined') {
              monitor.event('rich_audio_play', { fileId: opts.fileId });
            }
          }
        }
        if (typeof monitor !== 'undefined') {
          monitor.event('rich_open', { type: opts.type, messageId: this.properties.messageId });
        }
      } catch (e) {
        wx.showToast({ title: e.message || '打开失败', icon: 'none' });
        if (typeof monitor !== 'undefined') {
          monitor.error(e, { scene: 'rich.open', type: opts.type });
        }
      }
    },

    // 打开文件
    async openFile(opts) {
      try {
        const r = await this.requireScopesFor('file');
        if (!r.allGranted) return wx.showToast({ title: '未授权', icon: 'none' });
        const dl = await authz.downloadFile(opts.fileId, { type: 'file' });
        if (dl && dl.tempFilePath) {
          wx.openDocument({
            filePath: dl.tempFilePath,
            fileType: (opts.mime || '').split('/')[1] || '',
            showMenu: true,
            success: () => {
              if (typeof monitor !== 'undefined') {
                monitor.event('rich_file_open', { fileId: opts.fileId, mime: opts.mime });
              }
            },
            fail: (err) => {
              // 兜底: 提示用户保存
              wx.showModal({
                title: '已下载',
                content: `文件 ${opts.name || '已就绪'} 已临时下载`,
                showCancel: false
              });
            }
          });
        }
      } catch (e) {
        wx.showToast({ title: e.message || '下载失败', icon: 'none' });
      }
    },

    // 打开位置: 校验 + wx.openLocation
    async openLocation(opts) {
      try {
        if (!opts.latitude || !opts.longitude) {
          return wx.showToast({ title: '位置信息缺失', icon: 'none' });
        }
        // 客户端先调云函数校验
        const tk = await authz.getAuthToken({
          resourceType: 'location',
          resourceId: opts.latitude + ',' + opts.longitude,
          location: {
            latitude: opts.latitude,
            longitude: opts.longitude,
            accuracy: opts.accuracy || 0,
            scope: 'CN'
          }
        });
        if (!tk || !tk.token) return wx.showToast({ title: '位置校验失败', icon: 'none' });
        wx.openLocation({
          latitude: Number(opts.latitude),
          longitude: Number(opts.longitude),
          name: opts.name || '位置',
          address: opts.address || '',
          scale: Number(opts.scale || 16)
        });
        if (typeof monitor !== 'undefined') {
          monitor.event('rich_location_open', { messageId: this.properties.messageId });
        }
      } catch (e) {
        wx.showToast({ title: e.message || '打开位置失败', icon: 'none' });
      }
    },

    // 通用: 按 type 拿所需 scope 授权
    requireScopesFor(type) {
      const map = {
        image: ['scope.readPhotosAlbum'],
        video: ['scope.album', 'scope.readPhotosAlbum'],
        audio: ['scope.readPhotosAlbum'],
        voice: ['scope.microphone', 'scope.readPhotosAlbum'],
        file: ['scope.file']
      };
      const scopes = map[type] || [];
      return authz.requestScopes(scopes, { promptIfPermanent: true });
    },

    // 长按: 复制
    onLongText(e) {
      const { text } = e.currentTarget.dataset || {};
      if (text) this.onCopy({ currentTarget: { dataset: { text } } });
    }
  }
});
