// 服务市场
const { request } = require('../../../utils/request.js');
const { formatTime } = require('../../../utils/util.js');

const TYPE_TEXT = { birthday: '生日', wedding: '婚礼', corporate: '企业', party: '聚会' };
const STATUS_TEXT = { 1: '待报价', 2: '已报价', 3: '已确认', 4: '制作中', 5: '已交付', 0: '已取消' };

Page({
  data: {
    tab: 'custom',
    orders: []
  },

  onShow() { this.load(); },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.k });
    this.load();
  },

  async load() {
    const isCustom = this.data.tab === 'custom';
    const collection = isCustom ? 'customOrders' : 'bulkOrders';
    try {
      const r = await request('dbQuery', { collection, where: { _userId: 'me' }, orderBy: 'createTime', order: 'desc', limit: 20 }, { loading: false, silent: true });
      const list = (r.list || []).map(o => ({
        ...o,
        typeText: TYPE_TEXT[o.type] || '定制',
        statusText: STATUS_TEXT[o.status] || '处理中',
        createTimeText: formatTime(o.createTime)
      }));
      this.setData({ orders: list });
    } catch (e) {}
  },

  goCustom() { wx.navigateTo({ url: '/package-promo/pages/service/custom/custom' }); },
  goBulk() { wx.navigateTo({ url: '/package-promo/pages/service/bulk/bulk' }); },
  goBirthday() { wx.navigateTo({ url: '/package-promo/pages/service/birthday/birthday' }); },
  goSubscribe() { wx.navigateTo({ url: '/package-promo/pages/service/subscribe/subscribe' }); },
  goGift() { wx.navigateTo({ url: '/package-promo/pages/service/gift/gift' }); },
  goCust() { wx.switchTab({ url: '/pages/chat/session/session' }).catch(() => wx.navigateTo({ url: '/package-chat/pages/chat/session/session' })); }
});
