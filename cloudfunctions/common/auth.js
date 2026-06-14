// common/auth.js
// 统一授权管理
//   - 位置授权(经纬度精确度 + 范围校验)
//   - 媒体授权(图片/视频/文件/相册/相机/麦克风)
//   - 临时 URL 签发(云存储文件访问控制)
//   - 资源访问 token(防泄漏直链)
//
// 4 大维度:
//   1. 客户端权限 scope(userLocation / camera / album / microphone / file)
//   2. 服务端鉴权(短时 token / 签名 URL)
//   3. 业务校验(位置范围 / 文件大小 / 文件类型)
//   4. 审计(谁、什么时候、授权了啥)

const crypto = require('crypto');
const { cache } = require('./cache.js');
const { logger } = require('./logger.js');
const { ErrorCode, BizError } = require('./errors.js');

const SCOPE = {
  USER_LOCATION: 'userLocation',         // 精确位置
  USER_LOCATION_BACKGROUND: 'userLocationBackground',
  CAMERA: 'camera',                      // 相机
  ALBUM: 'album',                        // 相册
  MICROPHONE: 'microphone',              // 麦克风
  FILE: 'file',                          // 文件
  // 鸿蒙/安卓 / iOS 共用
  BLUETOOTH: 'bluetooth',
  NOTIFICATIONS: 'notifications',
  WRITE_PHOTOS: 'writePhotosAlbum',
  READ_PHOTOS: 'readPhotosAlbum'
};

const SCOPE_GROUPS = {
  LOCATION: [SCOPE.USER_LOCATION],
  MEDIA_PREVIEW: [],                     // 预览不需要 scope
  CAMERA: [SCOPE.CAMERA],
  ALBUM: [SCOPE.ALBUM, SCOPE.READ_PHOTOS],
  VIDEO: [SCOPE.CAMERA, SCOPE.MICROPHONE, SCOPE.ALBUM],
  FILE_DOWNLOAD: [SCOPE.FILE],
  VOICE: [SCOPE.MICROPHONE]
};

// 鉴权 token 配置
const TOKEN_TTL = 60;                     // 秒
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'cake-shop-auth-2024-32bytes!';
const FILE_MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/wav',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
];

// 位置服务范围(默认中国)
const LOCATION_BOUNDS = {
  CN: { lat: [3.86, 53.55], lng: [73.66, 135.05] },
  // 可扩展
  GLOBAL: { lat: [-90, 90], lng: [-180, 180] }
};
const LOCATION_PRECISION_MIN = 50;        // 米,小于此视为精度不足

/**
 * 校验客户端 scope 授权结果
 *   result: { scope: { userLocation: true|false, ... } }
 */
function validateScopeResult(result, required) {
  if (!result || typeof result !== 'object') {
    throw new BizError(ErrorCode.AUTH_DENIED, '授权结果缺失');
  }
  const scope = result.scope || {};
  const missing = [];
  for (const s of required) {
    if (scope[s] === false) {
      missing.push(s);
    } else if (scope[s] === undefined) {
      missing.push(s + '(未询问)');
    }
  }
  if (missing.length > 0) {
    const isPermanent = result.errMsg && result.errMsg.includes('auth deny');
    throw new BizError(
      isPermanent ? ErrorCode.AUTH_NEVER_ASK_AGAIN : ErrorCode.AUTH_DENIED,
      '未授权: ' + missing.join(', ')
    );
  }
  return true;
}

/**
 * 校验位置
 *   { latitude, longitude, accuracy, scope }
 *   scope: 'CN' | 'GLOBAL' | 边界对象
 */
function validateLocation(loc) {
  if (!loc || typeof loc !== 'object') {
    throw new BizError(ErrorCode.AUTH_LOCATION_DENIED, '位置信息缺失');
  }
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const acc = Number(loc.accuracy != null ? loc.accuracy : 0);
  if (isNaN(lat) || isNaN(lng)) {
    throw new BizError(ErrorCode.AUTH_LOCATION_DENIED, '位置格式错误');
  }
  // 精度
  if (acc > 0 && acc > LOCATION_PRECISION_MIN * 10) {
    throw new BizError(ErrorCode.AUTH_LOCATION_PRECISION_LOW,
      `位置精度不足: ${acc}m > ${LOCATION_PRECISION_MIN * 10}m`);
  }
  // 范围
  const bounds = typeof loc.scope === 'object' ? loc.scope
    : (LOCATION_BOUNDS[loc.scope] || LOCATION_BOUNDS.CN);
  if (lat < bounds.lat[0] || lat > bounds.lat[1] ||
      lng < bounds.lng[0] || lng > bounds.lng[1]) {
    throw new BizError(ErrorCode.AUTH_LOCATION_OUT_OF_RANGE,
      `位置不在服务范围 (${lat.toFixed(2)},${lng.toFixed(2)})`);
  }
  return { latitude: lat, longitude: lng, accuracy: acc, validatedAt: Date.now() };
}

/**
 * 校验文件
 */
function validateFile(file) {
  if (!file || typeof file !== 'object') {
    throw new BizError(ErrorCode.AUTH_FILE_DENIED, '文件信息缺失');
  }
  if (file.size != null && file.size > FILE_MAX_SIZE) {
    throw new BizError(ErrorCode.AUTH_FILE_TOO_LARGE,
      `文件超过 ${(FILE_MAX_SIZE / 1024 / 1024)}MB`);
  }
  if (file.mime && !ALLOWED_FILE_TYPES.includes(file.mime)) {
    throw new BizError(ErrorCode.AUTH_FILE_TYPE_DENIED, `不支持的 mime: ${file.mime}`);
  }
  return true;
}

/**
 * 签发资源访问 token
 *   { resourceType: 'file'|'image'|'video'|'audio'|'location',
 *     resourceId: fileId or url,
 *     userId, openid, scope,
 *     ttl (秒, 默认 60), meta }
 *   客户端用 token + resourceId 调 wx.cloud.downloadFile / previewImage
 */
function signToken(payload) {
  if (!payload || !payload.resourceType) {
    throw new BizError(ErrorCode.AUTH_TOKEN_INVALID, 'resourceType 必填');
  }
  const ttl = Math.min(payload.ttl || TOKEN_TTL, 600);  // 上限 10 分钟
  const exp = Date.now() + ttl * 1000;
  const body = {
    rt: payload.resourceType,
    rid: payload.resourceId,
    uid: payload.userId || '',
    oid: payload.openid || '',
    sc: payload.scope || 'public',
    exp,
    n: crypto.randomBytes(8).toString('hex')  // nonce 防重放
  };
  const json = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(json).digest('hex');
  const token = Buffer.from(json).toString('base64') + '.' + sig;
  // 缓存: 用于反查 + 撤销
  const cacheKey = 'auth:tok:' + body.n;
  cache.set(cacheKey, { body, sig }, ttl);
  return {
    token,
    expiresAt: exp,
    expiresIn: ttl
  };
}

/**
 * 校验 token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new BizError(ErrorCode.AUTH_TOKEN_INVALID);
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new BizError(ErrorCode.AUTH_TOKEN_INVALID);
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
  } catch (e) {
    throw new BizError(ErrorCode.AUTH_TOKEN_INVALID, 'token 解析失败');
  }
  // 签名
  const expectSig = crypto.createHmac('sha256', TOKEN_SECRET)
    .update(parts[0]).digest('hex');
  if (expectSig !== parts[1]) {
    throw new BizError(ErrorCode.AUTH_URL_SIGN_INVALID);
  }
  // 过期
  if (body.exp < Date.now()) {
    throw new BizError(ErrorCode.AUTH_URL_EXPIRED);
  }
  // cache 中是否还存在(防重放)
  const cached = cache.get('auth:tok:' + body.n);
  if (!cached) {
    // token 已用(一次性 nonce 失效)或过期
    throw new BizError(ErrorCode.AUTH_URL_EXPIRED);
  }
  // 一次性: 用完即焚
  cache.del('auth:tok:' + body.n);
  return body;
}

/**
 * 签发云存储临时 URL(小程序需拿这个 URL 去 wx.cloud.downloadFile)
 *   实际: 走云开发 wx.cloud.getTempFileURL API
 *   这里做一层:校验 + 签发 + 限流
 */
async function signCloudFileURL(db, fileId, userId, scope = 'private') {
  if (!fileId) throw new BizError(ErrorCode.AUTH_TOKEN_INVALID, 'fileId 必填');
  if (fileId.length > 200) throw new BizError(ErrorCode.AUTH_TOKEN_INVALID, 'fileId 过长');

  // 元数据
  const meta = await db.collection('chat_uploads').where({ fileId }).limit(1).get()
    .then(r => r.data && r.data[0])
    .catch(() => null);

  // 限流: 每用户每分钟最多 60 次临时 URL 签发
  const rateKey = 'auth:rate:' + (userId || 'anon');
  const cur = (cache.get(rateKey) || 0) + 1;
  cache.set(rateKey, cur, 60);
  if (cur > 60) {
    throw new BizError(ErrorCode.RATE_LIMIT, '签发太频繁');
  }

  // 签发 token
  const tk = signToken({
    resourceType: 'file',
    resourceId: fileId,
    userId,
    scope,
    ttl: 60
  });

  return {
    fileId,
    url: 'cloud://' + fileId,   // 实际由客户端调 wx.cloud.getTempFileURL
    authToken: tk.token,
    expiresAt: tk.expiresAt,
    meta: meta || null
  };
}

/**
 * 校验聊天内容中的"敏感节点"(位置/媒体/文件)是否已授权
 *   rich: 富文本节点数组
 *   grants: 客户端传入的 { scope: { userLocation, camera, album, ... } }
 *   - 没传 grants: 信任已询问(用于 send 阶段,不需要用户已点)
 *   - 传了 grants: 严格校验(用于 downloadFile / previewImage)
 */
function validateRichAuth(rich, grants) {
  if (!Array.isArray(rich)) return;
  if (!grants) return;       // send 阶段不强校验
  const need = new Set();
  for (const n of rich) {
    if (!n || !n.t) continue;
    if (n.t === 'location' || n.t === 'map') need.add(SCOPE.USER_LOCATION);
    if (n.t === 'img') need.add(SCOPE.READ_PHOTOS);
    if (n.t === 'video') need.add(SCOPE.ALBUM);
    if (n.t === 'file') need.add(SCOPE.FILE);
    if (n.t === 'voice' || n.t === 'audio') need.add(SCOPE.MICROPHONE);
  }
  if (need.size === 0) return;
  validateScopeResult(grants, Array.from(need));
}

/**
 * 鉴权审计
 *   { userId, openid, scope, action, resourceType, resourceId, granted, ip }
 */
async function auditAuth(db, event) {
  try {
    await db.collection('auth_logs').add({
      data: Object.assign({
        tenantId: event.tenantId || 'default',
        ts: Date.now()
      }, event)
    });
  } catch (e) {
    logger.warn('auth audit fail', { e: e.message });
  }
}

module.exports = {
  SCOPE,
  SCOPE_GROUPS,
  LOCATION_BOUNDS,
  LOCATION_PRECISION_MIN,
  FILE_MAX_SIZE,
  ALLOWED_FILE_TYPES,
  validateScopeResult,
  validateLocation,
  validateFile,
  signToken,
  verifyToken,
  signCloudFileURL,
  validateRichAuth,
  auditAuth,
  TOKEN_TTL
};
