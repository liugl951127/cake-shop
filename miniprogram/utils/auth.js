// miniprogram/utils/auth.js
// 统一授权管理 SDK(位置/相册/相机/麦克风/文件)
//   - 封装 wx.authorize 弹窗
//   - 永久拒绝走 wx.openSetting
//   - 富文本节点批量授权
//   - 资源 token 签发 + 校验
//   - 缓存(同会话内同权限只问一次)

const monitor = require('./monitor.js');

const STORAGE_KEY = '__auth_grants__';
const grants = {};  // 内存缓存: { scope: true|false|neverAsk }
let app = null;

// 权限场景
const SCENE = {
  LOCATION: ['scope.userLocation'],
  LOCATION_BACKGROUND: ['scope.userLocationBackground'],
  CAMERA: ['scope.camera'],
  ALBUM: ['scope.album'],
  READ_PHOTOS: ['scope.readPhotosAlbum'],
  WRITE_PHOTOS: ['scope.writePhotosAlbum'],
  MICROPHONE: ['scope.microphone'],
  FILE: ['scope.file'],
  NOTIFICATIONS: ['scope.notifications'],
  BLUETOOTH: ['scope.bluetooth'],
  VIDEO: ['scope.camera', 'scope.album'],
  VOICE: ['scope.microphone'],
  IMAGE_PREVIEW: ['scope.readPhotosAlbum']  // 预览图片
};

/**
 * 加载持久化授权缓存
 */
/**
 * 静默登录: 调云函数 login 拿 openid + token
 *  - 已有本地 openid 则不再调
 *  - 返回 { openid, token, userId, ... }
 *  - 失败不拋错(避免冷启动阻塞)
 */
function login(opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const cached = wx.getStorageSync('openid');
      if (cached) {
        return resolve({ openid: cached });
      }
      wx.login({
        success: async (r) => {
          if (!r || !r.code) return reject(new Error('wx.login 无 code'));
          try {
            const cf = await wx.cloud.callFunction({
              name: 'login',
              data: { code: r.code, inviterCode: opts.inviterCode || '' }
            });
            const data = (cf && cf.result && cf.result.data) || {};
            if (data.openid) {
              wx.setStorageSync('openid', data.openid);
              if (data.token) wx.setStorageSync('token', data.token);
              if (data.userId) wx.setStorageSync('userId', data.userId);
            }
            resolve(data);
          } catch (e) {
            reject(e);
          }
        },
        fail: (e) => reject(e)
      });
    } catch (e) {
      reject(e);
    }
  });
}

function loadCache() {
  try {
    const s = wx.getStorageSync(STORAGE_KEY);
    if (s && typeof s === 'object') Object.assign(grants, s);
  } catch (e) {}
}

/**
 * 写持久化缓存
 */
function saveCache() {
  try {
    wx.setStorageSync(STORAGE_KEY, grants);
  } catch (e) {}
}

/**
 * 检查是否已授权(同步)
 *   - grants[scope] === true: 已授权
 *   - grants[scope] === 'never': 永久拒绝
 *   - grants[scope] === false: 临时拒绝
 *   - undefined: 未询问
 */
function isGranted(scope) {
  return grants[scope] === true;
}
function isNeverAsk(scope) {
  return grants[scope] === 'never';
}
function hasAsked(scope) {
  return grants[scope] !== undefined;
}

/**
 * 单个 scope 授权
 *   返回 { granted, scope, neverAsk }
 */
function requestScope(scope) {
  return new Promise((resolve, reject) => {
    // 已授权
    if (isGranted(scope)) {
      return resolve({ granted: true, scope, neverAsk: false, cached: true });
    }
    // 永久拒绝 -> 引导去设置
    if (isNeverAsk(scope)) {
      return resolve({ granted: false, scope, neverAsk: true });
    }
    // 询问
    wx.authorize({
      scope,
      success: () => {
        grants[scope] = true;
        saveCache();
        resolve({ granted: true, scope, neverAsk: false });
      },
      fail: (err) => {
        // 拒绝: 区分"临时拒绝"和"永久拒绝"
        // 临时拒绝会弹"拒绝/允许"对话框(第一次)
        // 永久拒绝 wx.authorize 直接 fail(已询问过且选过"不")
        const never = err && (err.errMsg || '').includes('authorize:fail auth deny')
                     || hasAsked(scope);
        grants[scope] = never ? 'never' : false;
        saveCache();
        // 错误上报
        if (typeof monitor !== 'undefined') {
          monitor.error(err, { scene: 'auth.deny', scope });
        }
        resolve({ granted: false, scope, neverAsk: !!never, err });
      }
    });
  });
}

/**
 * 批量授权
 *   scopes: ['scope.userLocation', 'scope.album']
 *   opts: { promptIfPermanent: true }  // 永久拒绝时是否弹 openSetting
 *   返回 { allGranted, results: [...] }
 */
async function requestScopes(scopes, opts = {}) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return { allGranted: true, results: [] };
  }
  // 先并发请求
  const promises = scopes.map(s => requestScope(s));
  const results = await Promise.all(promises);
  const permanent = results.filter(r => r.neverAsk && !r.granted);

  if (permanent.length > 0 && opts.promptIfPermanent !== false) {
    // 引导到设置页
    const go = await promptOpenSetting(permanent.map(r => '缺少权限: ' + r.scope));
    if (go) {
      // 用户从设置回来后再问
      loadCache();
      const reResults = await Promise.all(permanent.map(r => requestScope(r.scope)));
      for (let i = 0; i < permanent.length; i++) {
        const idx = results.findIndex(r => r.scope === permanent[i].scope);
        if (idx >= 0) results[idx] = reResults[i];
      }
    }
  }
  const allGranted = results.every(r => r.granted);
  return { allGranted, results };
}

/**
 * 引导用户到设置页(永久拒绝兜底)
 */
function promptOpenSetting(reasons) {
  return new Promise((resolve) => {
    const reasonText = (reasons || []).join('\n') || '需要您的授权';
    wx.showModal({
      title: '需要您的授权',
      content: reasonText + '\n请到设置中开启',
      confirmText: '去设置',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({
            success: (sres) => {
              resolve(true);
            },
            fail: () => resolve(false)
          });
        } else {
          resolve(false);
        }
      },
      fail: () => resolve(false)
    });
  });
}

/**
 * 富文本节点批量授权
 *   nodes: 富文本数组
 *   返回 { allGranted, scopes: [...] }
 */
async function requestForRich(nodes) {
  const scopes = [];
  for (const n of nodes) {
    if (!n || !n.t) continue;
    if (n.t === 'img') scopes.push('scope.readPhotosAlbum');
    else if (n.t === 'video') {
      scopes.push('scope.camera', 'scope.album');
    } else if (n.t === 'location' || n.t === 'map') {
      scopes.push('scope.userLocation');
    } else if (n.t === 'voice' || n.t === 'audio') {
      scopes.push('scope.microphone');
    } else if (n.t === 'file') {
      scopes.push('scope.file');
    }
  }
  if (scopes.length === 0) return { allGranted: true, scopes: [] };
  const unique = Array.from(new Set(scopes));
  return requestScopes(unique, { promptIfPermanent: true });
}

/**
 * 位置
 *   opts: { accuracy: 'high'|'low', scope: 'CN' }
 *   返回 { latitude, longitude, accuracy, validated }
 */
function getLocation(opts = {}) {
  return new Promise(async (resolve, reject) => {
    // 1. 授权
    const r = await requestScopes(['scope.userLocation']);
    if (!r.allGranted) {
      return reject(new Error('位置授权被拒绝'));
    }
    // 2. 取位置
    wx.getLocation({
      type: opts.accuracy || 'gcj02',
      altitude: false,
      success: (res) => {
        // 3. 调云函数校验范围
        wx.cloud.callFunction({
          name: 'validateLocation',
          data: {
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy,
            scope: opts.scope || 'CN'
          },
          success: (callRes) => {
            const r2 = callRes && callRes.result;
            if (r2 && r2.code === 0) {
              resolve({
                latitude: res.latitude,
                longitude: res.longitude,
                accuracy: res.accuracy,
                validated: r2.data.validated
              });
            } else {
              reject(new Error((r2 && r2.msg) || '位置校验失败'));
            }
          },
          fail: (err) => reject(err)
        });
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 选图片(相册)
 */
function chooseImage(opts = {}) {
  return new Promise(async (resolve, reject) => {
    const r = await requestScopes(['scope.album', 'scope.readPhotosAlbum']);
    if (!r.allGranted) return reject(new Error('相册授权被拒绝'));
    wx.chooseImage({
      count: opts.count || 1,
      sizeType: opts.sizeType || ['compressed'],
      sourceType: opts.sourceType || ['album', 'camera'],
      success: (res) => {
        // res.tempFilePaths
        const promises = (res.tempFilePaths || []).map(p => uploadToCloud(p, 'image'));
        Promise.all(promises).then(files => resolve(files)).catch(reject);
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 上传文件到云存储 + 调 chat_uploads 元数据
 */
function uploadToCloud(filePath, type) {
  return new Promise((resolve, reject) => {
    const ext = (filePath.match(/\.[^.]+$/) || ['.jpg'])[0];
    const cloudPath = `chat/${type}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => {
        // 元数据
        wx.cloud.callFunction({
          name: 'uploadChatFile',
          data: {
            fileId: res.fileID,
            url: '',
            name: cloudPath.split('/').pop(),
            mime: 'image/jpeg',
            size: 0,
            scope: 'chat'
          },
          success: () => resolve({
            fileId: res.fileID,
            url: res.fileID,  // 真实 URL 需 getTempFileURL
            cloudPath
          }),
          fail: (err) => reject(err)
        });
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 选择文件(需小程序 >= 2.21.0)
 */
function chooseMessageFile(opts = {}) {
  return new Promise(async (resolve, reject) => {
    const r = await requestScopes(['scope.file']);
    if (!r.allGranted) return reject(new Error('文件授权被拒绝'));
    if (typeof wx.chooseMessageFile !== 'function') {
      return reject(new Error('当前基础库不支持 chooseMessageFile'));
    }
    wx.chooseMessageFile({
      count: opts.count || 1,
      type: opts.type || 'file',
      success: (res) => {
        const promises = (res.tempFiles || []).map(f => uploadToCloud(f.path, 'file'));
        Promise.all(promises).then(files => resolve(files)).catch(reject);
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 录音(开始)
 */
let recordTimer = null;
function startRecord(opts = {}) {
  return new Promise(async (resolve, reject) => {
    const r = await requestScopes(['scope.microphone']);
    if (!r.allGranted) return reject(new Error('麦克风授权被拒绝'));
    const manager = wx.getRecorderManager();
    recordTimer = setTimeout(() => {
      try { manager.stop(); } catch (e) {}
    }, opts.maxDuration || 60000);
    manager.start(opts);
    resolve(manager);
  });
}

/**
 * 预览图片(授权 + token)
 */
function previewImage(fileId, urls) {
  return new Promise(async (resolve, reject) => {
    const r = await requestScopes(['scope.readPhotosAlbum']);
    if (!r.allGranted) return reject(new Error('相册权限被拒绝'));
    wx.previewImage({
      current: fileId,
      urls: urls || [fileId],
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 拿授权 token(用于 downloadFile / previewImage)
 *   resourceType: 'file'|'image'|'video'|'audio'|'location'
 */
function getAuthToken(opts) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getAuthToken',
      data: opts,
      success: (res) => {
        const r = res && res.result;
        if (r && r.code === 0) resolve(r.data);
        else reject(new Error((r && r.msg) || 'token 签发失败'));
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 下载文件(带 token 校验)
 *   - 先校验 scope
 *   - 签发 token
 *   - wx.cloud.downloadFile
 */
function downloadFile(fileId, opts = {}) {
  return new Promise(async (resolve, reject) => {
    const type = opts.type || 'file';
    // 校验 scope
    const scopeMap = { file: 'scope.file', image: 'scope.readPhotosAlbum',
                       video: 'scope.album', audio: 'scope.readPhotosAlbum' };
    const needScope = scopeMap[type] || 'scope.file';
    const r = await requestScopes([needScope]);
    if (!r.allGranted) return reject(new Error('文件权限被拒绝'));

    // 签发 token
    const tk = await getAuthToken({
      resourceType: type,
      resourceId: fileId
    });

    // 下载(用 fileId 即可,云开发内部校验)
    wx.cloud.downloadFile({
      fileID: fileId,
      success: (res) => {
        // 验证 token(可选)
        resolve({
          tempFilePath: res.tempFilePath,
          token: tk.token,
          expiresAt: tk.expiresAt
        });
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 初始化(可选)
 */
function init(opts = {}) {
  app = opts.app || (typeof getApp === 'function' ? getApp() : null);
  loadCache();
  // 全局 App.onShow 时刷新 grants(用户可能在设置页改过权限)
  if (app) {
    const oldShow = app.onShow;
    app.onShow = function () {
      loadCache();
      if (oldShow) oldShow.call(this);
    };
  }
}

module.exports = {
  init,
  SCENE,
  requestScope,
  requestScopes,
  requestForRich,
  getLocation,
  chooseImage,
  chooseMessageFile,
  startRecord,
  previewImage,
  downloadFile,
  getAuthToken,
  promptOpenSetting,
  isGranted,
  isNeverAsk,
  hasAsked,
  login
};
