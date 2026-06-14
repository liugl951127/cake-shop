// SSR 公共 JS
console.log('🎂 甜心蛋糕 SSR');

// 微信浏览器内唤起小程序
function openMiniProgram(path = 'pages/index/index') {
  if (typeof wx !== 'undefined' && wx.miniProgram) {
    wx.miniProgram.navigateTo({ url: '/' + path });
  } else {
    // 非微信环境
    if (/micromessenger/i.test(navigator.userAgent)) {
      alert('请使用小程序访问');
    } else {
      // 跳转到公众号文章或提示
      alert('请在微信中搜索"甜心蛋糕"小程序');
    }
  }
}
window.openMP = () => openMiniProgram('pages/index/index');
