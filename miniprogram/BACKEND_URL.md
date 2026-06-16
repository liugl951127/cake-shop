# 后端地址配置 (BACKEND_URL)

> 默认 `http://127.0.0.1:8080`(本地后端)
> 切换线上: 改 `globalThis.__BACKEND_URL`

## 3 种切换方式

### 方式 1: 改源码默认值
`miniprogram/utils/request.js`:
```js
const DEFAULT_BACKEND_URL = 'https://api.cakeshop.com';  // 改成这
```

### 方式 2: app.js onLaunch 设全局变量(推荐)
`miniprogram/app.js`:
```js
onLaunch() {
  globalThis.__BACKEND_URL = 'https://api.cakeshop.com';  // 取消注释
  // ...
}
```

### 方式 3: 微信开发者工具"自定义预处理"(无需改代码)
工具栏 → 详情 → 本地设置 → 自定义预处理(Condition):
```js
globalThis.__BACKEND_URL = 'https://api.cakeshop.com';
```
编译时自动注入。

---

## 域名校验警告

### 现象
```
https://api.cakeshop.com 不在以下 request 合法域名列表中
```

### 原因
- 微信小程序限制: 线上域名必须是 HTTPS 且在小程序后台配置
- 开发期可以用 HTTP + 127.0.0.1 绕过
- 详见 https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html

### 解法
**开发期**: 用默认 `http://127.0.0.1:8080`, 不需要任何配置

**发布前**:
1. 微信公众平台 → 开发 → 开发设置 → 服务器域名
2. `request 合法域名` 加 `https://api.cakeshop.com`
3. 切换 `globalThis.__BACKEND_URL` 到 `https://api.cakeshop.com`
4. **必须 HTTPS**, HTTP 线上会被拒

### 调试期"不校验合法域名"开关
工具栏 → 详情 → 本地设置 → 勾选 **"不校验合法域名、web-view (业务域名)、TLS 版本以及 HTTPS 证书"**
- **优点**: 临时能用 HTTP 调线上
- **缺点**: 容易在"勾选状态"下测 OK, 一发布就 404
- **建议**: 不要依赖此开关, 直接用 127.0.0.1 本地后端

---

## 检查后端连通

打开微信开发者工具控制台,执行:
```js
console.log('当前后端:', globalThis.__BACKEND_URL || 'http://127.0.0.1:8080');
wx.request({
  url: (globalThis.__BACKEND_URL || 'http://127.0.0.1:8080') + '/api/actuator/health',
  success: (res) => console.log('健康:', res.data),
  fail: (err) => console.error('不通:', err)
});
```

预期: `{ status: "UP" }` = 通; `fail` = 后端没启或地址错
