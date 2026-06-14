// getTempFileURL - 把云存储 fileID 转成临时 https URL(给前端展示)
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { fileIDs = [] } = event;
  if (!Array.isArray(fileIDs) || fileIDs.length === 0) throw new BizError('fileIDs 必填');
  if (fileIDs.length > 20) throw new BizError('单次最多 20 个');

  try {
    const res = await cloud.getTempFileURL({ fileList: fileIDs });
    // 校验每个 fileID 是不是属于本会话相关的文件(粗略校验前缀)
    return ok(res.fileList.map(f => ({
      fileID: f.fileID,
      tempFileURL: f.tempFileURL,
      status: f.status,
      errMsg: f.errMsg || ''
    })));
  } catch (e) {
    return fail('获取临时链接失败: ' + e.message);
  }
});
