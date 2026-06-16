// 蛋糕定制需求
const { request } = require('../../../../utils/request.js');
const { uploadImage } = require('../../../utils/upload.js');

Page({
  data: {
    type: 'birthday', size: '', flavor: '', quantity: 1,
    description: '', budget: '', images: [],
    contactName: '', contactPhone: '', needDate: '', address: '',
    now: ''
  },

  onLoad() {
    this.setData({ now: new Date().toISOString().slice(0, 16) });
  },

  onType(e) { this.setData({ type: e.currentTarget.dataset.k }); },
  onSize(e) { this.setData({ size: e.currentTarget.dataset.k }); },
  onFlavor(e) { this.setData({ flavor: e.currentTarget.dataset.k }); },
  onCount(e) {
    const d = Number(e.currentTarget.dataset.k);
    const v = Math.max(1, this.data.quantity + d);
    this.setData({ quantity: v });
  },
  onDesc(e) { this.setData({ description: e.detail.value }); },
  onBudget(e) { this.setData({ budget: e.detail.value }); },
  onName(e) { this.setData({ contactName: e.detail.value }); },
  onPhone(e) { this.setData({ contactPhone: e.detail.value }); },
  onDate(e) { this.setData({ needDate: e.detail.value }); },
  onAddr(e) { this.setData({ address: e.detail.value }); },

  onChoose() {
    const remain = 9 - this.data.images.length;
    wx.chooseMedia({
      count: remain, mediaType: ['image'],
      success: (res) => {
        const tasks = (res.tempFiles || []).map(f =>
          uploadImage(f.tempFilePath, 'custom/').catch(() => f.tempFilePath)
        );
        Promise.all(tasks).then((urls) => {
          this.setData({ images: this.data.images.concat(urls) });
        });
      }
    });
  },

  onPreview(e) {
    const i = e.currentTarget.dataset.i;
    wx.previewImage({ current: this.data.images[i], urls: this.data.images });
  },

  onDel(e) {
    const arr = this.data.images.slice();
    arr.splice(e.currentTarget.dataset.i, 1);
    this.setData({ images: arr });
  },

  onSubmit() {
    if (!this.data.contactName) return wx.showToast({ title: '请填联系人', icon: 'none' });
    if (!/^1\d{10}$/.test(this.data.contactPhone)) return wx.showToast({ title: '手机号错误', icon: 'none' });
    if (!this.data.description.trim()) return wx.showToast({ title: '请描述需求', icon: 'none' });
    if (this.data.description.length > 1000) return wx.showToast({ title: '描述 1000 字内', icon: 'none' });

    wx.showLoading({ title: '提交中' });
    request('submitCustom', {
      type: this.data.type,
      size: this.data.size,
      flavor: this.data.flavor,
      description: this.data.description,
      images: this.data.images,
      budget: this.data.budget,
      contactName: this.data.contactName,
      contactPhone: this.data.contactPhone,
      needDate: this.data.needDate,
      address: this.data.address,
      quantity: this.data.quantity
    }).then((r) => {
      wx.hideLoading();
      wx.showModal({
        title: '提交成功',
        content: '我们将在 1 小时内通过服务通知告知您报价',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: err.msg || '提交失败', icon: 'none' });
    });
  }
});
