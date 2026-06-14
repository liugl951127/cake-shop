// 低代码 + 模板化
const { request } = require('../../../../utils/request.js');

const COMPS = [
  { key: 'text', name: '文本', icon: '📝' },
  { key: 'image', name: '图片', icon: '🖼️' },
  { key: 'button', name: '按钮', icon: '🔘' },
  { key: 'list', name: '商品列表', icon: '📋' },
  { key: 'form', name: '表单', icon: '📝' },
  { key: 'stats', name: '统计卡片', icon: '📊' },
  { key: 'banner', name: '轮播', icon: '🎠' },
  { key: 'richText', name: '富文本', icon: '📄' },
  { key: 'card', name: '卡片', icon: '🃏' },
  { key: 'tabs', name: '标签', icon: '📑' },
  { key: 'search', name: '搜索', icon: '🔍' },
  { key: 'map', name: '地图', icon: '🗺️' },
  { key: 'countdown', name: '倒计时', icon: '⏰' },
  { key: 'share', name: '分享', icon: '🔗' },
  { key: 'coupon', name: '优惠券', icon: '🎟️' },
  { key: 'goods', name: '商品卡', icon: '🎂' }
];
const COMPS_MAP = {};
COMPS.forEach(c => COMPS_MAP[c.key] = c);

const FORM_TYPES = [
  { key: 'text', name: '文本', icon: '📝' },
  { key: 'number', name: '数字', icon: '🔢' },
  { key: 'textarea', name: '多行', icon: '📄' },
  { key: 'date', name: '日期', icon: '📅' },
  { key: 'datetime', name: '时间', icon: '⏰' },
  { key: 'select', name: '下拉', icon: '📋' },
  { key: 'radio', name: '单选', icon: '⚪' },
  { key: 'checkbox', name: '多选', icon: '☑️' },
  { key: 'switch', name: '开关', icon: '🔘' },
  { key: 'upload', name: '上传', icon: '📎' },
  { key: 'goods', name: '商品', icon: '🎂' },
  { key: 'user', name: '用户', icon: '👤' }
];
const FORM_TYPES_MAP = {};
FORM_TYPES.forEach(t => FORM_TYPES_MAP[t.key] = t);

const CAMPAIGN_TPL = {
  full_reduce: { name: '满减', fields: [
    { key: 'tiers', label: '档位', type: 'array' },
    { key: 'startTime', label: '开始时间', type: 'datetime' },
    { key: 'endTime', label: '结束时间', type: 'datetime' },
    { key: 'limitPerUser', label: '每人限', type: 'number' }
  ]},
  discount: { name: '折扣', fields: [
    { key: 'rate', label: '折扣(0-1)', type: 'number' },
    { key: 'goodsIds', label: '商品ID', type: 'text' }
  ]},
  seckill: { name: '秒杀', fields: [
    { key: 'goodsId', label: '商品ID', type: 'text' },
    { key: 'seckillPrice', label: '秒杀价', type: 'number' },
    { key: 'totalStock', label: '总库存', type: 'number' },
    { key: 'perUserLimit', label: '每人限', type: 'number' }
  ]},
  group: { name: '拼团', fields: [
    { key: 'goodsId', label: '商品ID', type: 'text' },
    { key: 'groupPrice', label: '拼团价', type: 'number' },
    { key: 'groupSize', label: '成团人数', type: 'number' },
    { key: 'duration', label: '有效时长(小时)', type: 'number' }
  ]},
  lucky_bag: { name: '福袋', fields: [
    { key: 'price', label: '价格', type: 'number' },
    { key: 'prizes', label: '奖品(JSON)', type: 'text' }
  ]}
};

const MARKET_TPLS = [
  { id: 'birthday_gift', name: '生日礼遇活动', icon: '🎂', category: 'campaign', description: '提前 7 天通知 + 自动发券' },
  { id: 'flash_sale', name: '限时秒杀', icon: '⚡', category: 'campaign', description: '倒计时 + 库存预警' },
  { id: 'group_buy_3', name: '3 人成团', icon: '👥', category: 'campaign', description: '老带新裂变' },
  { id: 'invite_reward', name: '邀请奖励', icon: '💌', category: 'rule', description: '双向积分 + 优惠券' },
  { id: 'vip_price', name: '会员价', icon: '👑', category: 'rule', description: '不同等级不同折扣' },
  { id: 'high_value_warning', name: '高价值关怀', icon: '⭐', category: 'rule', description: '消费 ≥ 1000 自动升级 VIP' },
  { id: 'complaint_priority', name: '投诉优先', icon: '⚠️', category: 'rule', description: '投诉类订单加急' },
  { id: 'returning_user', name: '回头客奖励', icon: '🔄', category: 'rule', description: '第 2 单起每单 9 折' }
];

Page({
  data: {
    tab: 'page',
    comps: COMPS, compsMap: COMPS_MAP,
    formTypes: FORM_TYPES, formTypesMap: FORM_TYPES_MAP,
    templates: MARKET_TPLS,

    // 页面
    components: [], pageName: '', pageSlug: '', pageId: '',
    // 报表
    report: { source: 'orders', metric: 'revenue', dimension: 'date', range: 'today' },
    reportResult: [],
    // 活动
    campaign: { type: 'full_reduce', name: '' }, campaignCfg: {},
    currentTemplate: CAMPAIGN_TPL.full_reduce,
    campaigns: [],
    // 表单
    formFields: [], formName: '',
    // 规则
    rule: { name: '', trigger: '', condition: '', action: '', priority: 0 },
    rules: []
  },

  onShow() {
    this.loadCampaigns();
    this.loadRules();
  },

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.k }); },

  // 页面
  onAddComp(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ components: this.data.components.concat([{ id: Date.now() + '', type: k, props: { content: '' } }]) });
  },
  onMoveUp(e) {
    const i = e.currentTarget.dataset.i;
    if (i === 0) return;
    const arr = this.data.components.slice();
    [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
    this.setData({ components: arr });
  },
  onDelComp(e) {
    const arr = this.data.components.slice();
    arr.splice(e.currentTarget.dataset.i, 1);
    this.setData({ components: arr });
  },
  onPageName(e) { this.setData({ pageName: e.detail.value }); },
  onPageSlug(e) { this.setData({ pageSlug: e.detail.value }); },

  async onSavePage() {
    if (!this.data.pageName) return wx.showToast({ title: '请填名称', icon: 'none' });
    try {
      const r = await request('lowcode', {
        action: 'savePage', id: this.data.pageId, name: this.data.pageName,
        slug: this.data.pageSlug, components: this.data.components
      }, { loading: false });
      this.setData({ pageId: r.id });
      wx.showToast({ title: '已保存' });
    } catch (e) { wx.showToast({ title: '失败', icon: 'none' }); }
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
      const r = await request('lowcode', {
        action: 'saveReport', name: `${this.data.report.metric}_${this.data.report.dimension}`,
        ...this.data.report
      }, { loading: false });
      if (r.id) {
        const r2 = await request('lowcode', { action: 'runReport', id: r.id }, { loading: false });
        this.setData({ reportResult: r2.list || [] });
      }
    } catch (e) { wx.showToast({ title: '失败', icon: 'none' }); }
  },

  // 活动
  onCT(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({
      'campaign.type': k,
      currentTemplate: { name: CAMPAIGN_TPL[k].name, fields: CAMPAIGN_TPL[k].fields }
    });
  },
  onCfg(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['campaignCfg.' + k]: e.detail.value });
  },
  onCN(e) { this.setData({ 'campaign.name': e.detail.value }); },

  async onSaveCampaign() {
    if (!this.data.campaign.name) return wx.showToast({ title: '请填名称', icon: 'none' });
    try {
      await request('lowcode', {
        action: 'saveCampaign', name: this.data.campaign.name,
        type: this.data.campaign.type, config: this.data.campaignCfg
      }, { loading: false });
      wx.showToast({ title: '已保存' });
      this.loadCampaigns();
    } catch (e) { wx.showToast({ title: '失败', icon: 'none' }); }
  },

  async loadCampaigns() {
    try {
      const r = await request('lowcode', { action: 'listCampaigns' }, { loading: false, silent: true });
      this.setData({ campaigns: r || [] });
    } catch (e) {}
  },

  // 表单
  onAddField(e) {
    const k = e.currentTarget.dataset.k;
    wx.showModal({
      title: '字段名', editable: true, placeholderText: '如:姓名',
      success: (res) => {
        if (res.confirm && res.content) {
          this.setData({
            formFields: this.data.formFields.concat([{ key: res.content + '_' + Date.now(), label: res.content, type: k, required: false }])
          });
        }
      }
    });
  },
  onDelField(e) {
    const arr = this.data.formFields.slice();
    arr.splice(e.currentTarget.dataset.i, 1);
    this.setData({ formFields: arr });
  },
  onFormName(e) { this.setData({ formName: e.detail.value }); },

  async onSaveForm() {
    if (!this.data.formName) return wx.showToast({ title: '请填名称', icon: 'none' });
    try {
      await request('lowcode', {
        action: 'saveForm', name: this.data.formName,
        slug: this.data.formName, fields: this.data.formFields
      }, { loading: false });
      wx.showToast({ title: '已保存' });
    } catch (e) { wx.showToast({ title: '失败', icon: 'none' }); }
  },

  // 规则
  onRuleName(e) { this.setData({ 'rule.name': e.detail.value }); },
  onRuleTrigger(e) { this.setData({ 'rule.trigger': e.detail.value }); },
  onRuleCond(e) { this.setData({ 'rule.condition': e.detail.value }); },
  onRuleAction(e) { this.setData({ 'rule.action': e.detail.value }); },
  onRulePriority(e) { this.setData({ 'rule.priority': Number(e.detail.value) || 0 }); },

  async onSaveRule() {
    if (!this.data.rule.name || !this.data.rule.trigger || !this.data.rule.action) {
      return wx.showToast({ title: '请填完整', icon: 'none' });
    }
    try {
      await request('lowcode', { action: 'saveRule', ...this.data.rule }, { loading: false });
      wx.showToast({ title: '已保存' });
      this.loadRules();
    } catch (e) { wx.showToast({ title: '失败', icon: 'none' }); }
  },

  async onToggleRule(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.detail.value ? 1 : 0;
    try {
      await request('lowcode', { action: 'toggleRule', id, status }, { loading: false });
      this.loadRules();
    } catch (e) {}
  },

  async loadRules() {
    try {
      const r = await request('lowcode', { action: 'listRules' }, { loading: false, silent: true });
      this.setData({ rules: r || [] });
    } catch (e) {}
  },

  // 模板市场
  async onApplyTpl(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request('lowcode', { action: 'applyTemplate', templateId: id, name: id }, { loading: false });
      wx.showToast({ title: '已应用' });
      this.loadCampaigns();
      this.loadRules();
    } catch (err) {
      wx.showToast({ title: err.msg || '失败', icon: 'none' });
    }
  }
});
