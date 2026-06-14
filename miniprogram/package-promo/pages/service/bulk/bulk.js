// 企业团采
const { request } = require('../../../../utils/request.js');

Page({
  data: {
    form: {
      companyName: '',
      contactName: '',
      contactPhone: '',
      itemList: [{ goodsName: '', count: '' }],
      totalCount: 10,
      budget: '',
      address: '',
      needDate: '',
      remark: '',
      needInvoice: false
    },
    now: ''
  },

  onLoad() { this.setData({ now: new Date().toISOString().slice(0, 16) }); },

  onK(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  onItemAdd() {
    this.setData({ 'form.itemList': this.data.form.itemList.concat([{ goodsName: '', count: '' }]) });
  },

  onItemDel(e) {
    const idx = e.currentTarget.dataset.idx;
    const arr = this.data.form.itemList.slice();
    arr.splice(idx, 1);
    this.setData({ 'form.itemList': arr });
  },

  onItem(e) {
    const { idx, k } = e.currentTarget.dataset;
    const arr = this.data.form.itemList.slice();
    arr[idx] = { ...arr[idx], [k]: e.detail.value };
    this.setData({ 'form.itemList': arr });
  },

  onCount(e) {
    const d = Number(e.currentTarget.dataset.k);
    const v = Math.max(10, (this.data.form.totalCount || 0) + d);
    this.setData({ 'form.totalCount': v });
  },

  onDate(e) { this.setData({ 'form.needDate': e.detail.value }); },
  onInvoice() { this.setData({ 'form.needInvoice': !this.data.form.needInvoice }); },

  onSubmit() {
    const f = this.data.form;
    if (!f.contactName) return wx.showToast({ title: '请填联系人', icon: 'none' });
    if (!/^1\d{10}$/.test(f.contactPhone)) return wx.showToast({ title: '手机号错误', icon: 'none' });
    if (f.totalCount < 10) return wx.showToast({ title: '团采 10 件起', icon: 'none' });

    wx.showLoading({ title: '提交中' });
    request('submitBulk', { ...f }).then(() => {
      wx.hideLoading();
      wx.showModal({
        title: '提交成功', content: '我们将在 2 小时内联系您报价',
        showCancel: false, success: () => wx.navigateBack()
      });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: err.msg || '失败', icon: 'none' });
    });
  }
});
