// cloudfunctions/getAuthToken/index.js
// 资源访问 token 签发
//   客户端: 拿到 token + fileId -> wx.cloud.downloadFile / previewImage
//   服务端: 校验 token + 临时 URL 签发
//
// 入参:
//   { resourceType: 'file'|'image'|'video'|'audio'|'location',
//     resourceId: fileId or 'lat,lng',
//     scope: 'private'|'public',
//     userId, openid,
//     location?: { latitude, longitude, accuracy, scope }  // 当 type=location
//   }
//
// 出参: { token, expiresAt, fileId/url, meta }

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const authz = require('../common/auth.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const { resourceType, resourceId, userId, openid, scope } = event;
  if (!resourceType) return fail('resourceType 必填', ErrorCode.BAD_REQUEST);
  if (!resourceId) return fail('resourceId 必填', ErrorCode.BAD_REQUEST);

  // 位置资源: 额外校验
  if (resourceType === 'location') {
    if (!event.location) return fail('位置信息缺失', ErrorCode.AUTH_LOCATION_DENIED);
    try {
      authz.validateLocation(event.location);
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail(e.message, ErrorCode.AUTH_LOCATION_DENIED);
    }
  }

  // 文件资源: 校验大小 + 类型
  if (['file', 'image', 'video', 'audio'].includes(resourceType)) {
    try {
      authz.validateFile({
        size: event.size,
        mime: event.mime
      });
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail(e.message, ErrorCode.AUTH_FILE_DENIED);
    }
  }

  let url = null;
  let meta = null;
  if (['file', 'image', 'video', 'audio'].includes(resourceType)) {
    // 云存储: 调 wx.cloud.getTempFileURL
    try {
      const r = await authz.signCloudFileURL(db, resourceId, userId, scope);
      url = r.url;
      meta = r.meta;
    } catch (e) {
      if (e.code) return fail(e.message, e.code);
      return fail(e.message, ErrorCode.WECOM_API_ERROR);
    }
  } else if (resourceType === 'location') {
    url = `geo:${resourceId}`;
  }

  // 签 token
  let tk;
  try {
    tk = authz.signToken({
      resourceType, resourceId, userId, openid, scope: scope || 'private',
      ttl: event.ttl || 60
    });
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.SYSTEM_ERROR);
  }

  // 审计
  await authz.auditAuth(db, {
    userId, openid,
    scope: scope || 'private',
    action: 'sign_token',
    resourceType, resourceId,
    granted: true,
    ip: context.SOURCE_IP || ''
  });

  logger.info('auth token signed', { resourceType, userId, expiresIn: tk.expiresIn });
  return ok({
    token: tk.token,
    expiresAt: tk.expiresAt,
    expiresIn: tk.expiresIn,
    url,
    meta
  });
});
