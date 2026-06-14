// components/transfer-human/index.js
// 转人工按钮 -> 企业微信客服
// props: { sessionId, userId, openid, openKfId?, reason, btnText, visible }

Component({
  properties: {
    sessionId: { type: String, value: '' },
    userId: { type: String, value: '' },
    openid: { type: String, value: '' },
    openKfId: { type: String, value: '' },
    reason: { type: String, value: 'user_request' },
    btnText: { type: String, value: '转人工客服' },
    visible: { type: Boolean, value: true }
  },

  data: {
    loading: false
  },

  methods: {
    async onTransfer() {
      if (this.data.loading) return;
      this.setData({ loading: true });
      try {
        // 1. 调 transferToWeCom 云函数,拿跳转参数
        const r = await wx.cloud.callFunction({
          name: 'transferToWeCom',
          data: {
            sessionId: this.data.sessionId,
            userId: this.data.userId,
            openid: this.data.openid,
            openKfId: this.data.openKfId,
            reason: this.data.reason,
            nickName: (wx.getStorageSync('userInfo') || {}).nickName || ''
          }
        });
        const result = r && r.result;
        if (!result || result.code !== 0) {
          wx.showToast({ title: result && result.msg || '转接失败', icon: 'none' });
          return;
        }
        const d = result.data;
        if (!d.corpId || !d.openKfId) {
          wx.showToast({ title: '客服未配置', icon: 'none' });
          return;
        }

        // 2. 跳企业微信小程序客服(基础库 2.19.0+)
        if (typeof wx.openCustomerServiceChat === 'function') {
          try {
            await new Promise((resolve, reject) => {
              wx.openCustomerServiceChat({
                corpId: d.corpId,
                extInfo: { url: d.sceneParam || '' },
                success: resolve,
                fail: reject
              });
            });
            this.triggerEvent('success', { data: d });
            return;
          } catch (e) {
            console.warn('openCustomerServiceChat fail', e);
            // 兜底:跳企业微信小程序
            if (d.miniProgram && d.miniProgram.appId) {
              wx.navigateToMiniProgram({
                appId: d.miniProgram.appId,
                path: d.miniProgram.path,
                extraData: d.miniProgram.extraData
              });
              this.triggerEvent('success', { data: d });
              return;
            }
          }
        }

        // 3. 兜底:跳转 H5(企业微信客服网页)
        if (d.sceneParam) {
          wx.navigateTo({
            url: '/package-user/pages/webview/webview?url=' + encodeURIComponent(
              'https://work.weixin.qq.com/kfid/' + d.openKfId
            ) + '&title=企业微信客服'
          });
        }
        this.triggerEvent('success', { data: d });
      } catch (e) {
        console.error('[transfer] fail', e);
        this.triggerEvent('error', { err: e });
        wx.showToast({ title: '转接异常', icon: 'none' });
      } finally {
        this.setData({ loading: false });
      }
    }
  }
});
