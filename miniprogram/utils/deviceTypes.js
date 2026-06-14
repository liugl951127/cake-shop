// miniprogram/utils/deviceTypes.js
// 客户端版本(简化) - 与 cloudfunctions/common/device.js 对齐

const Platform = {
  IOS: 'ios',
  ANDROID: 'android',
  HARMONY: 'harmony',
  WINDOWS: 'windows',
  MACOS: 'macos',
  LINUX: 'linux',
  DEVTOOLS: 'devtools',
  OTHER: 'other'
};

const FormFactor = {
  PHONE: 'phone',
  TABLET: 'tablet',
  FOLDABLE: 'foldable',
  DESKTOP: 'desktop',
  OTHER: 'other'
};

const Breakpoint = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  XXL: 'xxl'
};

const BREAKPOINT_PX = {
  xs: 0, sm: 375, md: 640, lg: 768, xl: 1024, xxl: 1280
};

function breakpointFor(width) {
  if (width >= BREAKPOINT_PX.xxl) return Breakpoint.XXL;
  if (width >= BREAKPOINT_PX.xl) return Breakpoint.XL;
  if (width >= BREAKPOINT_PX.lg) return Breakpoint.LG;
  if (width >= BREAKPOINT_PX.md) return Breakpoint.MD;
  if (width >= BREAKPOINT_PX.sm) return Breakpoint.SM;
  return Breakpoint.XS;
}

module.exports = {
  Platform, FormFactor, Breakpoint, BREAKPOINT_PX, breakpointFor
};
