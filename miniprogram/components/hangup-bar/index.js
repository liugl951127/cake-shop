// components/hangup-bar/index.js
// 挂断按钮 + 评价弹窗
// props: { sessionId, userId, status, visible }
// event: hangup(挂断成功) / rated(评分提交)

Component({
  properties: {
    sessionId: { type: String, value: '' },
    userId: { type: String, value: '' },
    status: { type: String, value: 'ai' },  // pending/ai/agent/transferred/closed
    visible: { type: Boolean, value: true }
  },

  data: {
    loading: false,
    closed: false,
    statusClass: '',
    statusText: '',
    showRate: false,
    rateScore: 0,
    rateTags: [],
    rateComment: '',
    rateTagsOptions: ['专业', '热情', '响应快', '解决到位', '有耐心', '建议改进'],
    rateTagsList: []
  },

  observers: {
    'status,rateTagsOptions,rateTags': function (s) {
      const closed = s === 'closed' || s === 'archived';
      const map = {
        pending: { cls: 'pending', text: '正在为您分配客服...' },
        ai: { cls: 'ai', text: 'AI 客服为您服务' },
        agent: { cls: 'agent', text: '人工客服为您服务' },
        transferred: { cls: 'transferred', text: '已转企业微信客服' },
        waiting: { cls: 'waiting', text: '排队中...' },
        closed: { cls: 'closed', text: '本次咨询已结束' },
        archived: { cls: 'closed', text: '本次咨询已结束' }
      };
      const m = map[s] || { cls: '', text: '' };
      // 同步 rateTagsList (模板里不能调 .includes)
      const sel = new Set(this.data.rateTags || []);
      const list = (this.data.rateTagsOptions || []).map(name => ({
        name,
        selected: sel.has(name)
      }));
      this.setData({
        closed,
        statusClass: m.cls,
        statusText: m.text,
        rateTagsList: list
      });
    }
  },

  methods: {
    async onHangup() {
      const reason = await this.promptReason();
      if (reason === null) return;
      this.setData({ loading: true });
      try {
        const r = await wx.cloud.callFunction({
          name: 'clientHangup',
          data: { sessionId: this.data.sessionId, userId: this.data.userId, reason }
        });
        const result = r && r.result;
        if (!result || result.code !== 0) {
          wx.showToast({ title: result && result.msg || '挂断失败', icon: 'none' });
          return;
        }
        this.setData({ closed: true, status: 'closed' });
        this.triggerEvent('hangup', result.data);
        // 自动打开评价
        setTimeout(() => this.setData({ showRate: true }), 300);
      } catch (e) {
        wx.showToast({ title: '挂断异常', icon: 'none' });
      } finally {
        this.setData({ loading: false });
      }
    },

    promptReason() {
      return new Promise((resolve) => {
        const items = ['问题已解决', '暂时不需要', '换个方式', '等待太久', '其他原因'];
        wx.showActionSheet({
          itemList: items,
          success: (res) => resolve(items[res.tapIndex]),
          fail: () => resolve(null)
        });
      });
    },

    setRate(e) {
      this.setData({ rateScore: e.currentTarget.dataset.s });
    },
    toggleTag(e) {
      const t = e.currentTarget.dataset.t;
      const tags = this.data.rateTags;
      const i = tags.indexOf(t);
      if (i >= 0) tags.splice(i, 1);
      else tags.push(t);
      this.setData({ rateTags: tags });
    },
    onRateComment(e) {
      this.setData({ rateComment: e.detail.value });
    },
    closeRate() { this.setData({ showRate: false }); },

    async submitRate() {
      if (this.data.rateScore === 0) {
        wx.showToast({ title: '请先打分', icon: 'none' });
        return;
      }
      try {
        await wx.cloud.callFunction({
          name: 'rateChat',
          data: {
            sessionId: this.data.sessionId,
            score: this.data.rateScore,
            tags: this.data.rateTags,
            comment: this.data.rateComment,
            from: 'client'
          }
        });
        wx.showToast({ title: '感谢评价', icon: 'success' });
        this.setData({ showRate: false });
        this.triggerEvent('rated', {
          score: this.data.rateScore,
          tags: this.data.rateTags
        });
      } catch (e) {
        wx.showToast({ title: '评价失败', icon: 'none' });
      }
    }
  }
});
