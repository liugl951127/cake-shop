// 活体检测(简化版:4 步动作 + 演示通过)
// 真实环境: 用 wx.serviceMarket 调腾讯云慧眼 或 微信原生 wx.faceDetect
const { request } = require('../../../../utils/request.js');
const { uploadImage } = require('../../../../utils/upload.js');

const STEPS = [
  { emoji: '😊', text: '请正对手机' },
  { emoji: '😉', text: '请眨眼' },
  { emoji: '🙂', text: '请点头' },
  { emoji: '😮', text: '请张嘴' }
];

Page({
  data: {
    step: 1,
    stepEmoji: '😊',
    actionText: '请正对手机',
    videoUrl: '',
    submitting: false
  },

  onLoad() {
    this.setData({
      stepEmoji: STEPS[0].emoji,
      actionText: STEPS[0].text
    });
  },

  async onCapture() {
    if (this.data.submitting) return;

    if (this.data.step < 4) {
      // 演示:拍照(无权限)直接进入下一步
      // 真实:wx.faceDetect / 服务市场
      const next = this.data.step + 1;
      this.setData({
        step: next,
        stepEmoji: STEPS[next - 1].emoji,
        actionText: STEPS[next - 1].text
      });
      wx.vibrateShort({ type: 'light' });
      return;
    }

    // 最后一步:提交认证
    this.setData({ submitting: true });
    wx.showLoading({ title: '认证中' });

    try {
      // 真实流程:
      // 1. 拍 5 秒活体视频
      // 2. 上传云存储
      // 3. 调 livenessDetect
      // 演示:跳过上传,直接通过
      const r = await request('livenessDetect', {
        videoUrl: 'demo://video',
        action: 'all',
        idCard: ''
      }, { loading: false });
      wx.hideLoading();
      if (r.passed) {
        wx.showModal({
          title: '活体认证通过',
          content: `相似度: ${(r.faceScore * 100).toFixed(0)}%`,
          showCancel: false,
          success: () => wx.navigateBack()
        });
      } else {
        wx.showToast({ title: '未通过,请重试', icon: 'none' });
        this.setData({ step: 1, stepEmoji: STEPS[0].emoji, actionText: STEPS[0].text, submitting: false });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: err.msg || '失败', icon: 'none' });
    }
  }
});
