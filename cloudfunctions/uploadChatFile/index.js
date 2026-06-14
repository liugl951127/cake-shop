// cloudfunctions/uploadChatFile/index.js
// 客服/聊天场景下的文件上传授权
//
// 入参:
//   name      原始文件名
//   mime      mime 类型
//   size      字节
//   width/height (图片)
//   scope     chat/rich/behavior
//   sessionId 用于云存储路径
//
// 实际接收文件由客户端调 wx.cloud.uploadFile,这里返回 fileId + 持久化元数据
// 客户端流程:
//   1) 调本函数获取 uploadInfo / scope 路径规则
//   2) 客户端上传到指定 cloudPath
//   3) 客户端拿到 fileId 后调 sendMessage(extra.fileId=fileId, type=image/file)

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const { saveUploadMeta } = require('../common/storage.js');

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4', 'audio/mpeg', 'audio/mp3', 'text/plain'
];

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || '';

  const { name, mime, size, width, height, scope, sessionId } = event;
  if (!name) return fail('name 必填', ErrorCode.BAD_REQUEST);
  if (!mime) return fail('mime 必填', ErrorCode.BAD_REQUEST);
  if (!size || size > MAX_SIZE) return fail(`文件不能超过 ${MAX_SIZE} 字节`, ErrorCode.CHAT_UPLOAD_FAILED);
  if (!ALLOWED_MIME.includes(mime)) {
    return fail(`不支持的 mime: ${mime}`, ErrorCode.CHAT_UPLOAD_FAILED);
  }

  // 生成 cloudPath 规则: chat/{sessionId}/{yyyyMM}/{openid}-{ts}-{name}
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
  const safeName = String(name).replace(/[^\w.\-]+/g, '_').slice(0, 64);
  const cloudPath = `${scope || 'chat'}/${sessionId || 'common'}/${yyyymm}/${openid || 'anon'}-${now.getTime()}-${safeName}`;

  // 直接让客户端调 wx.cloud.uploadFile 拿 fileId
  // 这里返回元数据记录 + cloudPath 指引
  const meta = {
    fileId: '',         // 客户端拿到后回填
    url: '',
    name: safeName,
    mime, size,
    width: width || 0, height: height || 0,
    scope: scope || 'chat',
    uploader: openid,
    cloudPath
  };

  // 记录元数据(允许空 fileId,客户端上传完成后可再回调本函数回填)
  const saved = await saveUploadMeta(db, meta);

  logger.info('upload meta created', { cloudPath, mime, size, by: openid });
  return ok({ ...saved, cloudPath });
});
