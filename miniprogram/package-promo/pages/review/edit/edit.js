// 评价编辑
const { request } = require('../../../../utils/request.js');
const { uploadImage } = require('../../../utils/upload.js');

Page({
  data: {
    orderId: '',
    goodsId: '',
    parentId: '',
    score: 5,
    content: '',
    images: [],
    anonymous: false,
    submitting: false
  },

  onLoad(q) {
    this.setData({
      orderId: q.orderId || '',
      goodsId: q.goodsId || '',
      parentId: q.parentId || ''
    });
  },

  onStar(e) { this.setData({ score: e.currentTarget.dataset.i }); },
  onInput(e) { this.setData({ content: e.detail.value }); },
  onAnon() { this.setData({ anonymous: !this.data.anonymous }); },

  onChoose() {
    const remain = 9 - this.data.images.length;
    wx.chooseMedia({
      count: remain, mediaType: ['image'],
      success: (res) => {
        const files = res.tempFiles || [];
        // 上传
        const tasks = files.map(f => uploadImage(f.tempFilePath, 'reviews/').catch(() => f.tempFilePath));
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
    const i = e.currentTarget.dataset.i;
    const arr = this.data.images.slice();
    arr.splice(i, 1);
    this.setData({ images: arr });
  },

  onSubmit() {
    if (!this.data.orderId || !this.data.goodsId) {
      return wx.showToast({ title: '参数缺失', icon: 'none' });
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中' });
    request('addReview', {
      orderId: this.data.orderId,
      goodsId: this.data.goodsId,
      score: this.data.score,
      content: this.data.content,
      images: this.data.images,
      anonymous: this.data.anonymous,
      parentId: this.data.parentId
    }, { loading: false }).then((r) => {
      wx.hideLoading();
      wx.showToast({
        title: r.points ? `评价成功 +${r.points}积分` : '提交成功',
        icon: 'success'
      });
      setTimeout(() => wx.navigateBack(), 800);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: err.msg || '提交失败', icon: 'none' });
    });
  }
});
