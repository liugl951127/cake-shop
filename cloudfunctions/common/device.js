// common/device.js
// 设备能力检测 + 兼容性规范
//   - 平台识别: ios/android/harmony/windows/macos/linux/other
//   - 设备形态: phone/tablet/foldable/desktop
//   - 屏幕断点: xs/sm/md/lg/xl/xxl(响应式 6 档)
//   - 折叠屏: 检测 aspectRatio 突变(可配合前端)

const { logger } = require('./logger.js');
const { ErrorCode, BizError } = require('./errors.js');

// 平台
const Platform = {
  IOS: 'ios',
  ANDROID: 'android',
  HARMONY: 'harmony',
  WINDOWS: 'windows',
  MACOS: 'macos',
  LINUX: 'linux',
  OTHER: 'other'
};

// 设备形态
const FormFactor = {
  PHONE: 'phone',
  TABLET: 'tablet',          // iPad / Android Tab
  FOLDABLE: 'foldable',      // Mate X / Galaxy Fold / 小米 MIX Fold
  DESKTOP: 'desktop',
  OTHER: 'other'
};

// 断点(对齐 Tailwind)
const Breakpoint = {
  XS: 'xs',     // < 375
  SM: 'sm',     // 375-639
  MD: 'md',     // 640-767
  LG: 'lg',     // 768-1023  iPad
  XL: 'xl',     // 1024-1279
  XXL: 'xxl'    // >= 1280
};

const BREAKPOINT_PX = {
  xs: 0, sm: 375, md: 640, lg: 768, xl: 1024, xxl: 1280
};

/**
 * 从 UA / hint 推断平台
 */
function detectPlatform(ua = '', hint = '') {
  const s = (ua || '').toLowerCase() + ' ' + (hint || '').toLowerCase();
  if (/iphone|ipad|ipod|ios/.test(s)) return Platform.IOS;
  if (/harmonyos|hongmeng|鸿蒙/.test(s)) return Platform.HARMONY;
  if (/android/.test(s)) return Platform.ANDROID;
  if (/windows/.test(s)) return Platform.WINDOWS;
  if (/mac os|macos/.test(s)) return Platform.MACOS;
  if (/linux/.test(s)) return Platform.LINUX;
  return Platform.OTHER;
}

/**
 * 推断设备形态
 *   - 折叠屏(优先) / 平板 / 手机 / 桌面
 */
function detectFormFactor(opts) {
  const { platform, screenWidth, screenHeight, ua, isFoldable, isTablet } = opts;
  if (isFoldable) return FormFactor.FOLDABLE;
  if (isTablet) return FormFactor.TABLET;
  // iPad 通常 ua 含 iPad,Android 平板 screenWidth >= 600 dp
  if (platform === Platform.IOS && /ipad/.test((ua || '').toLowerCase())) return FormFactor.TABLET;
  if (screenWidth && screenWidth >= 600 && platform !== Platform.WINDOWS) return FormFactor.TABLET;
  if (platform === Platform.WINDOWS || platform === Platform.MACOS) return FormFactor.DESKTOP;
  return FormFactor.PHONE;
}

/**
 * 根据宽度返回断点
 */
function breakpointFor(width) {
  if (width >= BREAKPOINT_PX.xxl) return Breakpoint.XXL;
  if (width >= BREAKPOINT_PX.xl) return Breakpoint.XL;
  if (width >= BREAKPOINT_PX.lg) return Breakpoint.LG;
  if (width >= BREAKPOINT_PX.md) return Breakpoint.MD;
  if (width >= BREAKPOINT_PX.sm) return Breakpoint.SM;
  return Breakpoint.XS;
}

/**
 * 规范化 deviceInfo(从 event 读取)
 *   期望字段: platform, formFactor, screenWidth, screenHeight, dpr, ua, version
 */
function normalizeDevice(event) {
  const d = event.deviceInfo || event.device || {};
  if (!d || typeof d !== 'object') {
    throw new BizError(ErrorCode.DEVICE_INFO_INVALID, 'deviceInfo 缺失');
  }
  const platform = d.platform || detectPlatform(d.ua);
  const formFactor = d.formFactor || detectFormFactor({
    platform, ua: d.ua,
    screenWidth: d.screenWidth, screenHeight: d.screenHeight,
    isFoldable: d.isFoldable, isTablet: d.isTablet
  });
  const sw = Number(d.screenWidth) || 0;
  const sh = Number(d.screenHeight) || 0;
  const breakpoint = sw > 0 ? breakpointFor(sw) : null;
  return {
    platform,
    formFactor,
    screenWidth: sw,
    screenHeight: sh,
    dpr: Number(d.dpr) || 1,
    ua: d.ua || '',
    appVersion: d.appVersion || d.version || '',
    osVersion: d.osVersion || '',
    brand: d.brand || '',
    model: d.model || '',
    isFoldable: !!d.isFoldable || formFactor === FormFactor.FOLDABLE,
    breakpoint,
    capturedAt: d.capturedAt || Date.now()
  };
}

/**
 * 兼容性: 给一个平台 + 设备,返回能力/限制列表
 *   - 鸿蒙 WebView 早期版本不支持某些 API
 *   - iOS Safari 一些差异
 *   - 折叠屏布局特殊处理
 */
function capabilities(platform, formFactor) {
  const caps = {
    websocket: true,
    localStorage: true,
    indexedDB: platform !== Platform.HARMONY || true,
    touch: formFactor !== FormFactor.DESKTOP,
    backgroundSync: true,
    webWorker: true,
    serviceWorker: platform !== Platform.HARMONY,
    webviewX5: platform === Platform.ANDROID && /micromessenger|qq/.test(this && this.ua || ''),
    // 折叠屏特殊
    foldableAdaptive: formFactor === FormFactor.FOLDABLE
  };
  // 鸿蒙 webview 老内核(API < 7) 限制
  if (platform === Platform.HARMONY) {
    caps.serviceWorker = false;
    caps.backgroundSync = false;
  }
  // iOS WKWebView 限制
  if (platform === Platform.IOS) {
    caps.backgroundSync = false;  // iOS 后台受限
  }
  return caps;
}

/**
 * 验证上报的 deviceInfo
 */
function assertValid(d) {
  if (!d.platform) throw new BizError(ErrorCode.DEVICE_INFO_INVALID, 'platform 必填');
  if (!Object.values(Platform).includes(d.platform)) {
    throw new BizError(ErrorCode.UNSUPPORTED_PLATFORM, d.platform);
  }
  if (d.breakpoint && !Object.values(Breakpoint).includes(d.breakpoint)) {
    throw new BizError(ErrorCode.SCREEN_BREAKPOINT_INVALID, d.breakpoint);
  }
}

module.exports = {
  Platform, FormFactor, Breakpoint,
  BREAKPOINT_PX,
  detectPlatform,
  detectFormFactor,
  breakpointFor,
  normalizeDevice,
  capabilities,
  assertValid
};
