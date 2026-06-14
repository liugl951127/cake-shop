// 低代码设计器
const { request } = require('../../../../utils/request.js');

const COMPS = [
  { key: 'text', name: '文本', icon: '📝' },
  { key: 'image', name: '图片', icon: '🖼️' },
  { key: 'button', name: '按钮', icon: '🔘' },
  { key: 'list', name: '商品列表', icon: '📋' },
  { key: 'form', name: '表单', icon: '📝' },
  { key: 'stats', name: '统计卡片', icon: '📊' },
  { key: 'banner', name: '轮播图', icon: '🎠' },
  { key: 'richText', name: '富文本', icon: '📄' }
];
const COMPS_MAP = {};
COMPS.forEach(c => { COMPS_MAP[c.key] = c; });

Page({
  data: {
    tab: 'page',
    comps: COMPS,
    compsMap: COMPS_MAP,
    components: [],
    pageName: '',
    pageSlug: '',
    pageId: '',
    report: { source: 'orders', metric: 'revenue', dimension: 'date', range: 'today' },
    reportResult: [],
    campaign: { type: 'full_reduce', name: '' },
    campaigns: []
  },

  onShow() { this.loadCampaigns(); },

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.k }); },

  // 页面
  onAddComp(e) {
    const k = e.currentTarget.dataset.k;
    const components = this.data.components.concat([{ id: Date.now() + '', type: k, props: { content: '新组件' } }]);
    this.setData({ components });
  },
  onEditComp(e) {
    const i = e.currentTarget.dataset.i;
    wx.showModal({
      title: '编辑内容',
      editable: true,
      placeholderText: '输入内容',
      success: (res) => {
        if (res.confirm && res.content) {
          const components = this.data.components.slice();
          components[i] = { ...components[i], content: res.content };
          this.setData({ components });
        }
      }
    });
  },
  onDelComp(e) {
    const i = e.currentTarget.dataset.i;
    const arr = this.data.components.slice();
    arr.splice(i, 1);
    this.setData({ components: arr });
  },
  onPageName(e) { this.setData({ pageName: e.detail.value }); },
  onPageSlug(e) { this.setData({ pageSlug: e.detail.value }); },

  async onSavePage() {
    if (!this.data.pageName) return wx.showToast({ title: '请填名称', icon: 'none' });
    try {
      const r = await request('lowcode', {
        action: 'savePage',
        id: this.data.pageId, name: this.data.pageName,
        slug: this.data.pageSlug, components: this.data.components
      }, { loading: false });
      this.setData({ pageId: r.id });
      wx.showToast({ title: '已保存' });
    } catch (e) {
      wx.showToast({ title: '失败', icon: 'none' });
    }
  },

  async onPublish() {
    await this.onSavePage();
    try {
      await request('lowcode', { action: 'publishPage', id: this.data.pageId }, { loading: false });
      wx.showToast({ title: '已发布' });
    } catch (e) {}
  },

  // 报表
  onSrc(e) { this.setData({ 'report.source': e.currentTarget.dataset.k }); },
  onMetric(e) { this.setData({ 'report.metric': e.currentTarget.dataset.k }); },
  onDim(e) { this.setData({ 'report.dimension': e.currentTarget.dataset.k }); },
  onRange(e) { this.setData({ 'report.range': e.currentTarget.dataset.k }); },

  async onRunReport() {
    try {
      // 先存,再跑
      const r = await request('lowcode', {
        action: 'saveReport',
        name: `${this.data.report.metric}_${this.data.report.dimension}_${this.data.report.range}`,
        ...this.data.report
      }, { loading: false });
      if (r.id) {
        const r2 = await request('lowcode', { action: 'runReport', id: r.id }, { loading: false });
        this.setData({ reportResult: r2.list || [] });
      }
    } catch (e) {
      wx.showToast({ title: '失败', icon: 'none' });
    }
  },

  // 活动
  onCT(e) { this.setData({ 'campaign.type': e.currentTarget.dataset.k }); },
  onCN(e) { this.setData({ 'campaign.name': e.detail.value }); },

  async onSaveCampaign() {
    if (!this.data.campaign.name) return wx.showToast({ title: '请填名称', icon: 'none' });
    try {
      await request('lowcode', {
        action: 'saveCampaign',
        name: this.data.campaign.name,
        type: this.data.campaign.type,
        config: {}
      }, { loading: false });
      wx.showToast({ title: '已保存' });
      this.loadCampaigns();
    } catch (e) {}
  },

  async loadCampaigns() {
    try {
      const r = await request('lowcode', { action: 'listCampaigns' }, { loading: false, silent: true });
      this.setData({ campaigns: r || [] });
    } catch (e) {}
  }
});
