// 实名认证
const { request } = require('../../../../utils/request.js');
const { uploadImage } = require('../../../utils/upload.js');

const ID_REGEX = /^\d{17}[\dXx]$/;
function validateIdCard(id) {
  if (!ID_REGEX.test(id)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * weights[i];
  return codes[sum % 11] === id[17].toUpperCase();
}

Page({
  data: {
    form: { name: '', idCard: '' },
    idImgUrl: '',
    idValid: false,
    submitting: false
  },

  onK(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value, idValid: k === 'idCard' ? validateIdCard(e.detail.value) : this.data.idValid });
  },

  onChooseId() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const f = res.tempFiles[0];
        if (!f) return;
        uploadImage(f.tempFilePath, 'verify/').then((url) => {
          this.setData({ idImgUrl: url });
          // 调 OCR
          return request('ocrIdCard', { imgUrl: url, side: 'front' }, { loading: true, silent: true });
        }).then((r) => {
          if (r && r.name && r.idCard) {
            wx.showToast({ title: '识别成功' });
            this.setData({
              'form.name': r.name,
              'form.idCard': r.idCard,
              idValid: validateIdCard(r.idCard)
            });
          }
        }).catch(() => {});
      }
    });
  },

  onDelId() { this.setData({ idImgUrl: '' }); },

  onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.form.name) return wx.showToast({ title: '请填姓名', icon: 'none' });
    if (!validateIdCard(this.data.form.idCard)) return wx.showToast({ title: '身份证号错误', icon: 'none' });

    this.setData({ submitting: true });
    wx.showLoading({ title: '认证中' });
    request('realNameVerify', {
      name: this.data.form.name,
      idCard: this.data.form.idCard,
      channel: this.data.idImgUrl ? 'ocr' : 'manual'
    }).then((r) => {
      wx.hideLoading();
      wx.showModal({
        title: '认证成功', content: `欢迎,${r.name}!`,
        showCancel: false, success: () => wx.navigateBack()
      });
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: err.msg || '认证失败', icon: 'none' });
    });
  }
});
