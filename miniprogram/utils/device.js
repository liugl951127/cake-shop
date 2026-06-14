// miniprogram/utils/device.js
// 设备能力检测 SDK(兼容小程序的 js api 限制)
//   平台/形态/屏幕/UA 一次性获取
//   断线状态: 监听 wx.onNetworkStatusChange
//   折叠屏: 通过 wx.getSystemInfoSync().screenWidth/Height 推断
//   鸿蒙: wx.getSystemInfoSync().system 含 'harmony'

const { Platform, FormFactor, Breakpoint, breakpointFor } = require('./deviceTypes.js');

let cached = null;
let networkListeners = [];

function getSystemInfo() {
  if (typeof wx === 'undefined') return {};
  try { return wx.getSystemInfoSync() || {}; } catch (e) { return {}; }
}

function detectPlatform() {
  if (typeof wx === 'undefined') return Platform.OTHER;
  const sys = getSystemInfo();
  const s = (sys.system || '').toLowerCase();
  const platform = (sys.platform || '').toLowerCase();
  if (/harmony|鸿蒙|hongmeng|ohos/.test(s) || /harmony|鸿蒙/.test(platform)) {
    return Platform.HARMONY;
  }
  if (/ios|iphone|ipad/.test(s)) return Platform.IOS;
  if (/android/.test(s)) return Platform.ANDROID;
  if (/devtools/.test(platform)) return Platform.DEVTOOLS;
  return Platform.OTHER;
}

function detectFormFactor(platform) {
  if (typeof wx === 'undefined') return FormFactor.PHONE;
  const sys = getSystemInfo();
  // 折叠屏: 鸿蒙 / Android 折叠屏 标记
  if (sys.isFoldable || sys.brand && /fold|mate x|mix fold|galaxy fold/i.test(sys.brand + (sys.model || ''))) {
    return FormFactor.FOLDABLE;
  }
  // iPad
  if (platform === Platform.IOS) {
    if (sys.model && /ipad/i.test(sys.model)) return FormFactor.TABLET;
    // 旧 iOS 用 screenWidth/TotalWidth 比例
    if (sys.screenWidth >= 768) return FormFactor.TABLET;
  }
  if (platform === Platform.ANDROID || platform === Platform.HARMONY) {
    // 平板通常 >= 600dp
    if (sys.screenWidth >= 600) return FormFactor.TABLET;
  }
  return FormFactor.PHONE;
}

/**
 * 获取设备信息(带缓存)
 */
function getDeviceInfo(force = false) {
  if (cached && !force) return cached;
  if (typeof wx === 'undefined') {
    cached = { platform: Platform.OTHER, formFactor: FormFactor.PHONE, screenWidth: 0, screenHeight: 0 };
    return cached;
  }
  const sys = getSystemInfo();
  const platform = detectPlatform();
  const formFactor = detectFormFactor(platform);
  const sw = sys.screenWidth || 0;
  const sh = sys.screenHeight || 0;
  cached = {
    platform,
    formFactor,
    screenWidth: sw,
    screenHeight: sh,
    dpr: sys.pixelRatio || 1,
    ua: sys.system + ' ' + (sys.model || ''),
    appVersion: sys.version || '1.0.0',
    osVersion: sys.system || '',
    brand: sys.brand || '',
    model: sys.model || '',
    isFoldable: formFactor === FormFactor.FOLDABLE,
    breakpoint: sw > 0 ? breakpointFor(sw) : Breakpoint.MD,
    capturedAt: Date.now()
  };
  return cached;
}

/**
 * 能力子集
 */
function capabilities(platform, formFactor) {
  const caps = {
    websocket: true,
    localStorage: true,
    networkStatus: typeof wx !== 'undefined' && !!wx.onNetworkStatusChange,
    getSystemInfo: typeof wx !== 'undefined' && !!wx.getSystemInfoSync,
    backgroundAudio: typeof wx !== 'undefined' && !!wx.getBackgroundAudioManager,
    livePusher: typeof wx !== 'undefined' && !!wx.createLivePusherContext,
    foldableAdaptive: formFactor === FormFactor.FOLDABLE
  };
  return caps;
}

/**
 * 监听网络变化(返回 unsubscribe)
 */
function onNetworkChange(handler) {
  if (typeof wx === 'undefined' || !wx.onNetworkStatusChange) {
    return () => {};
  }
  const fn = (res) => {
    handler({
      isConnected: res.isConnected,
      networkType: res.networkType
    });
  };
  wx.onNetworkStatusChange(fn);
  networkListeners.push(fn);
  return () => {
    try { wx.offNetworkStatusChange(fn); } catch (e) {}
    const i = networkListeners.indexOf(fn);
    if (i >= 0) networkListeners.splice(i, 1);
  };
}

/**
 * 屏幕断点监听(折叠屏展开/收起)
 *   鸿蒙 / Android 折叠屏:wx.onWindowResize 触发
 */
function onWindowResize(handler) {
  if (typeof wx === 'undefined' || !wx.onWindowResize) return () => {};
  const fn = (res) => {
    handler({
      width: res.size.windowWidth,
      height: res.size.windowHeight,
      breakpoint: breakpointFor(res.size.windowWidth || 0)
    });
  };
  wx.onWindowResize(fn);
  return () => { try { wx.offWindowResize(fn); } catch (e) {} };
}

/**
 * 标记: 此设备是否需要 fallback / polyfill
 */
function needsPolyfill() {
  const d = getDeviceInfo();
  return d.platform === Platform.HARMONY && d.osVersion && !/^3\./.test(d.appVersion || '');
}

module.exports = {
  getDeviceInfo,
  capabilities,
  onNetworkChange,
  onWindowResize,
  needsPolyfill,
  Platform, FormFactor, Breakpoint
};
