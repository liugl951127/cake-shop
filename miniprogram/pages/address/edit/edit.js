const { request } = require('../../utils/request.js');

Page({
  data: {
    id: '',
    form: { name: '', phone: '', region: '', detail: '', isDefault: false }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.load(options.id);
    }
  },

  async load(id) {
    try {
      const list = await request('getAddress', {}, { loading: false });
      const item = list.find(i => i._id === id);
      if (item) this.setData({ form: item });
    } catch (e) {}
  },

  onI(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [`form.${k}`]: e.detail.value });
  },

  onSwitch(e) {
    this.setData({ 'form.isDefault': e.detail.value });
  },

  chooseRegion() {
    // 简化:使用微信内置 region picker
    if (wx.miniProgram && wx.miniProgram.navigateTo) {
      // 非原生支持时使用系统 picker
    }
    // 实际项目中建议引入 city-picker 组件,这里使用内置多列选择器的降级
    wx.showActionSheet({
      itemList: ['北京市 北京市 东城区', '上海市 上海市 黄浦区', '广州市 广东省 天河区', '深圳市 广东省 南山区'],
      success: (res) => {
        const map = {
          0: '北京市 北京市 东城区',
          1: '上海市 上海市 黄浦区',
          2: '广东省 广州市 天河区',
          3: '广东省 深圳市 南山区'
        };
        this.setData({ 'form.region': map[res.tapIndex] });
      }
    });
  },

  async save() {
    const f = this.data.form;
    if (!f.name) return wx.showToast({ title: '请输入姓名', icon: 'none' });
    if (!/^1\d{10}$/.test(f.phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    if (!f.region) return wx.showToast({ title: '请选择地区', icon: 'none' });
    if (!f.detail) return wx.showToast({ title: '请输入详细地址', icon: 'none' });

    try {
      if (this.data.id) {
        await request('updateAddress', { id: this.data.id, ...f });
      } else {
        await request('addAddress', f);
      }
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {}
  }
});
