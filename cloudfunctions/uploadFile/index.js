const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  // 上传逻辑由前端 wx.cloud.uploadFile 直接处理,本云函数仅返回已上传的 fileID
  return ok();
});
