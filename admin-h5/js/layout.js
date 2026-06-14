// admin-h5/js/layout.js
// 公共布局脚本(主框架页 + 业务页都引用)
(function () {
  // 自动守卫:未登录跳到登录页
  if (!http.getToken() && !location.pathname.endsWith('/login.html')) {
    location.href = '/pages/login/login.html';
    return;
  }
})();
