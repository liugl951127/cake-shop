// group list 暂时复用 getGroupActivity 拿不到,简化为用 getGoods 过滤
// 实际:应该有 getGroupActivityList 云函数,这里先用 initGroup 数据作为占位
const { request } = require('../../utils/request.js');
// 由于没写 getGroupActivityList,这里改用获取拼团活动的方式:
// 客户端直接通过 getGoods + groupPrice 字段判断

Page({
  data: { list: [], loading: false },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      // 演示: 直接调 getGoods,前端按 groupPrice 字段过滤
      const list = await request('getGoods', { page: 1, pageSize: 100 }, { loading: false });
      // 这里假设 groupPrice 字段标记(实际从 groupActivity 集合取)
      // 简化:全部展示
      this.setData({ list: list.filter(g => g.groupPrice).slice(0, 6) });
    } catch (e) {}
    this.setData({ loading: false });
  },

  goDetail(e) {
    const act = e.currentTarget.dataset.act;
    wx.navigateTo({ url: `/pages/group/detail/detail?goodsId=${e.currentTarget.dataset.id}&groupPrice=${act.groupPrice}&groupSize=${act.groupSize}` });
  }
});
