// 转接会话
const { request } = require('../../../../utils/request.js');

Page({
  data: {
    sessionId: '',
    tab: 'skill',
    skillGroups: [],
    allAgents: [],
    keyword: '',
    selectedGroupId: '',
    selectedAgentId: '',
    reason: '',
    urgent: false,
    role: 'helper'
  },

  onLoad(q) {
    this.setData({ sessionId: q.sessionId || '' });
    this.loadGroups();
    this.loadAgents();
  },

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.k }); },
  setRole(e) { this.setData({ role: e.currentTarget.dataset.k }); },

  selectGroup(e) { this.setData({ selectedGroupId: e.currentTarget.dataset.id, selectedAgentId: '' }); },
  selectAgent(e) { this.setData({ selectedAgentId: e.currentTarget.dataset.id, selectedGroupId: '' }); },

  onSearch(e) { this.setData({ keyword: e.detail.value }); },
  onReason(e) { this.setData({ reason: e.detail.value }); },
  toggleUrgent() { this.setData({ urgent: !this.data.urgent }); },

  async loadGroups() {
    try {
      const r = await request('getSkillGroups', {}, { loading: false, silent: true });
      this.setData({ skillGroups: r || [] });
    } catch (e) {}
  },

  async loadAgents() {
    try {
      const r = await request('getAgents', { online: true }, { loading: false, silent: true });
      this.setData({ allAgents: r || [] });
    } catch (e) {}
  },

  onSubmit() {
    const { tab, sessionId, selectedGroupId, selectedAgentId, reason, urgent } = this.data;
    if (tab === 'skill' && !selectedGroupId) {
      return wx.showToast({ title: '请选择技能组', icon: 'none' });
    }
    if ((tab === 'agent' || tab === 'triage') && !selectedAgentId) {
      return wx.showToast({ title: '请选择坐席', icon: 'none' });
    }

    wx.showLoading({ title: '提交中' });
    const action = tab === 'triage' ? 'inviteToSession' : 'transferAgent';
    const data = { sessionId, urgent };
    if (tab === 'skill') {
      data.transferType = 'skill';
      data.targetSkillGroupId = selectedGroupId;
    } else if (tab === 'agent') {
      data.transferType = 'agent';
      data.targetAgentId = selectedAgentId;
    } else {
      data.invitedAgentId = selectedAgentId;
      data.role = this.data.role;
    }
    data.reason = reason;

    request(action, data).then((r) => {
      wx.hideLoading();
      if (tab === 'triage') {
        wx.showToast({ title: '已邀请' });
      } else {
        wx.showToast({ title: '已转接,等待接单' });
      }
      setTimeout(() => wx.navigateBack(), 800);
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: err.msg || '失败', icon: 'none' });
    });
  }
});
