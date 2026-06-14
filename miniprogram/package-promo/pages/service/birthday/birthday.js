// 生日提醒
const { request } = require('../../../../utils/request.js');

Page({
  data: {
    list: [],
    showAdd: false,
    form: { name: '', type: 'self', birthday: '', giftPref: '' }
  },

  onShow() { this.load(); },

  async load() {
    try {
      const r = await request('birthdayReminder', { action: 'list' }, { loading: false, silent: true });
      this.setData({ list: r || [] });
    } catch (e) {}
  },

  onAdd() { this.setData({ showAdd: true, form: { name: '', type: 'self', birthday: '', giftPref: '' } }); },
  closeAdd() { this.setData({ showAdd: false }); },

  onFormName(e) { this.setData({ 'form.name': e.detail.value }); },
  onFormType(e) { this.setData({ 'form.type': e.currentTarget.dataset.k }); },
  onFormDate(e) { this.setData({ 'form.birthday': e.detail.value }); },
  onFormGift(e) { this.setData({ 'form.giftPref': e.detail.value }); },

  onSave() {
    const f = this.data.form;
    if (!f.name) return wx.showToast({ title: '请填姓名', icon: 'none' });
    if (!f.birthday) return wx.showToast({ title: '请选生日', icon: 'none' });
    request('birthdayReminder', {
      action: 'set', name: f.name, type: f.type,
      birthday: f.birthday, giftPref: f.giftPref
    }).then(() => {
      this.setData({ showAdd: false });
      wx.showToast({ title: '已添加' });
      this.load();
    });
  },

  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示', content: '确认删除该生日提醒?',
      success: (r) => {
        if (r.confirm) {
          request('birthdayReminder', { action: 'delete', id }).then(() => this.load());
        }
      }
    });
  }
});
