const { request } = require('../../../../utils/request.js');
const { updateProfile } = require('../../../../utils/auth.js');

Page({
  data: {
    id: '',
    form: {
      name: '', phone: '', region: '', detail: '',
      provinceId: 0, cityId: 0, districtId: 0,
      provinceName: '', cityName: '', districtName: '',
      isDefault: false, avatarUrl: ''
    },
    // 省市区选择器状态
    showRegion: false,
    regionStep: 1,  // 1-省 2-市 3-区
    regionList: [],
    provinceId: 0, provinceName: '',
    cityId: 0, cityName: '',
    districtId: 0, districtName: '',
    selectedId: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id) {
    try {
      const list = await request('getAddress', {}, { loading: false, silent: true });
      const item = list.find(i => i._id === id);
      if (item) {
        this.setData({
          form: {
            name: item.name, phone: item.phone, region: item.region, detail: item.detail,
            provinceId: item.provinceId || 0, cityId: item.cityId || 0, districtId: item.districtId || 0,
            provinceName: item.provinceName || '', cityName: item.cityName || '', districtName: item.districtName || '',
            isDefault: !!item.isDefault, avatarUrl: item.avatarUrl || ''
          }
        });
      }
    } catch (e) {}
  },

  onI(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [`form.${k}`]: e.detail.value });
  },

  onSwitch(e) {
    this.setData({ 'form.isDefault': e.detail.value });
  },

  // 选头像(用 button open-type="chooseAvatar")
  chooseAvatar() {
    // 此处用新版 chooseMedia 兼容旧版
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const file = res.tempFiles[0];
        wx.showLoading({ title: '上传中' });
        const ext = (file.tempFilePath.match(/\.(\w+)$/) || ['', '.jpg'])[0];
        const cloudPath = `avatar/${Date.now()}${ext}`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath,
          success: (r) => {
            this.setData({ 'form.avatarUrl': r.fileID });
            // 同步更新用户头像
            updateProfile(wx.getStorageSync('userInfo').nickName, r.fileID).catch(() => {});
          },
          fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
          complete: () => wx.hideLoading()
        });
      }
    });
  },

  // 打开省市区选择器
  async chooseRegion() {
    this.setData({
      showRegion: true,
      regionStep: 1,
      regionList: []
    });
    this.loadRegionList(0);
  },

  closeRegion() {
    this.setData({ showRegion: false });
  },

  async loadRegionList(parent) {
    try {
      const list = await request('getRegions', { parent }, { loading: false, silent: true });
      this.setData({ regionList: list });
    } catch (e) {}
  },

  selectRegion(e) {
    const item = e.currentTarget.dataset.item;
    const { regionStep } = this.data;

    if (regionStep === 1) {
      this.setData({
        provinceId: item.id, provinceName: item.name,
        cityId: 0, cityName: '', districtId: 0, districtName: '',
        regionStep: 2, regionList: [], selectedId: 0
      });
      this.loadRegionList(item.id);
    } else if (regionStep === 2) {
      this.setData({
        cityId: item.id, cityName: item.name,
        districtId: 0, districtName: '',
        regionStep: 3, regionList: [], selectedId: 0
      });
      this.loadRegionList(item.id);
    } else {
      // 第三步: 选完区,完成
      this.setData({
        districtId: item.id, districtName: item.name,
        selectedId: item.id,
        'form.region': `${this.data.provinceName} ${this.data.cityName} ${item.name}`,
        'form.provinceId': this.data.provinceId,
        'form.cityId': this.data.cityId,
        'form.districtId': item.id,
        'form.provinceName': this.data.provinceName,
        'form.cityName': this.data.cityName,
        'form.districtName': item.name
      });
      setTimeout(() => this.closeRegion(), 200);
    }
  },

  backToStep(e) {
    const s = Number(e.currentTarget.dataset.s);
    this.setData({ regionStep: s, selectedId: 0 });
    if (s === 1) this.loadRegionList(0);
    else if (s === 2) this.loadRegionList(this.data.provinceId);
    else this.loadRegionList(this.data.cityId);
  },

  // 导入微信地址
  importWx() {
    if (!wx.chooseAddress) {
      return wx.showToast({ title: '当前微信版本不支持', icon: 'none' });
    }
    wx.chooseAddress({
      success: (res) => {
        this.setData({
          'form.name': res.userName,
          'form.phone': res.telNumber,
          'form.region': `${res.provinceName} ${res.cityName} ${res.countyName}`,
          'form.detail': `${res.detailInfo || ''} ${res.streetName || ''}`.trim() || res.detailInfo,
          'form.provinceName': res.provinceName,
          'form.cityName': res.cityName,
          'form.districtName': res.countyName
        });
        wx.showToast({ title: '已导入微信地址' });
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '导入失败', icon: 'none' });
        }
      }
    });
  },

  // 地图选点
  chooseLocation() {
    if (!wx.chooseLocation) {
      return wx.showToast({ title: '当前微信版本不支持', icon: 'none' });
    }
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'form.detail': res.address ? `${res.address} ${res.name}` : res.name,
          'form.lng': res.longitude,
          'form.lat': res.latitude
        });
        wx.showToast({ title: '已选位置' });
      }
    });
  },

  async save() {
    const f = this.data.form;
    if (!f.name) return wx.showToast({ title: '请输入姓名', icon: 'none' });
    if (!/^1\d{10}$/.test(f.phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    if (!f.region) return wx.showToast({ title: '请选择地区', icon: 'none' });
    if (!f.detail || f.detail.length < 5) return wx.showToast({ title: '详细地址至少 5 字', icon: 'none' });

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
