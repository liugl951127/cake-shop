// 员工管理
const { request } = require('../../../../utils/request.js');

const ROLE_MAP = {
  super_admin: '超管', admin: '店长', operator: '运营',
  finance: '财务', customer_service: '客服', readonly: '只读'
};

const ROLES = [
  { key: 'super_admin', name: '超级管理员', perms: 99 },
  { key: 'admin', name: '店长', perms: 11 },
  { key: 'operator', name: '运营', perms: 4 },
  { key: 'finance', name: '财务', perms: 4 },
  { key: 'customer_service', name: '客服', perms: 4 },
  { key: 'readonly', name: '只读', perms: 6 }
];

Page({
  data: {
    list: [],
    roleMap: ROLE_MAP,
    roles: ROLES
  },

  onShow() { this.load(); },

  async load() {
    try {
      const r = await request('rbac', { action: 'list' }, { loading: false, silent: true });
      this.setData({ list: r || [] });
    } catch (e) {}
  },

  onAdd() {
    wx.showModal({
      title: '新增员工', editable: true, placeholderText: '格式: 姓名,手机号,角色(admin/operator/finance/customer_service/readonly)',
      success: async (res) => {
        if (!res.confirm) return;
        const parts = (res.content || '').split(/[,，\s]+/);
        if (parts.length < 3) return wx.showToast({ title: '格式错误', icon: 'none' });
        try {
          await request('rbac', {
            action: 'create',
            name: parts[0], phone: parts[1], role: parts[2],
            password: '123456'
          });
          wx.showToast({ title: '已添加' });
          this.load();
        } catch (e) {
          wx.showToast({ title: e.msg || '失败', icon: 'none' });
        }
      }
    });
  },

  async onToggle(e) {
    const i = e.currentTarget.dataset.i;
    const e2 = this.data.list[i];
    try {
      await request('rbac', {
        action: 'update', id: e2._id,
        status: e2.status === 1 ? 0 : 1
      });
      this.load();
    } catch (err) {
      wx.showToast({ title: '失败', icon: 'none' });
    }
  },

  onChangeRole(e) {
    const i = e.currentTarget.dataset.i;
    const e2 = this.data.list[i];
    const items = Object.keys(ROLE_MAP).map(k => ROLE_MAP[k]);
    wx.showActionSheet({
      itemList: items,
      success: async (res) => {
        const newRole = Object.keys(ROLE_MAP)[res.tapIndex];
        try {
          await request('rbac', { action: 'update', id: e2._id, role: newRole });
          this.load();
        } catch (err) {
          wx.showToast({ title: '失败', icon: 'none' });
        }
      }
    });
  }
});
