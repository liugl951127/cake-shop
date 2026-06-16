const { request } = require('../../../../utils/request.js');

Page({
  data: {
    id: '',
    form: { name: '', desc: '', price: '', originPrice: '', stock: 0, image: '', category: '', recommend: false, status: 1 },
    categories: [],
    catIndex: 0
  },

  onLoad(options) {
    this.loadCategories();
    if (options.id) {
      this.setData({ id: options.id });
      this.loadDetail(options.id);
    }
  },

  async loadCategories() {
    try {
      const cats = await request('getCategories', {}, { loading: false });
      this.setData({ categories: cats });
    } catch (e) {}
  },

  async loadDetail(id) {
    try {
      const data = await request('getGoodsDetail', { id });
      this.setData({ form: { ...data, status: data.status !== undefined ? data.status : 1 } });
    } catch (e) {}
  },

  onI(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [`form.${k}`]: e.detail.value });
  },

  onSwitch(e) {
    this.setData({ [`form.${e.currentTarget.dataset.k}`]: e.detail.value });
  },

  onStatus(e) {
    this.setData({ 'form.status': e.detail.value ? 1 : 0 });
  },

  onCatChange(e) {
    const idx = Number(e.detail.value);
    const cat = this.data.categories[idx];
    this.setData({
      catIndex: idx,
      'form.category': cat._id,
      'form.categoryName': cat.name
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        wx.showLoading({ title: '上传中' });
        const ext = file.tempFilePath.match(/\.(\w+)$/);
        const cloudPath = `goods/${Date.now()}-${Math.random().toString(36).substr(2, 6)}${ext || '.jpg'}`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath,
          success: (r) => this.setData({ 'form.image': r.fileID }),
          fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
          complete: () => wx.hideLoading()
        });
      }
    });
  },

  async save() {
    const f = this.data.form;
    if (!f.name) return wx.showToast({ title: '请填写名称', icon: 'none' });
    if (!f.price) return wx.showToast({ title: '请填写价格', icon: 'none' });
    if (!f.image) return wx.showToast({ title: '请上传商品图', icon: 'none' });
    if (!f.category) return wx.showToast({ title: '请选择分类', icon: 'none' });

    try {
      const payload = {
        ...f,
        price: Number(f.price),
        originPrice: Number(f.originPrice) || 0,
        stock: Number(f.stock) || 0
      };
      delete payload.categoryName;

      if (this.data.id) {
        await request('adminUpdateGoods', { id: this.data.id, ...payload });
      } else {
        await request('adminAddGoods', payload);
      }
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {}
  }
});
