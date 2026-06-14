# 甜心蛋糕 - 管理后台 H5

纯静态 H5,挂在 Spring Boot 后台的静态资源下,统一从 `/api/*` 调后端 REST。

## 4 套主题

- 🌸 **樱花**(默认)- 粉/蜜桃,适合生活类/电商
- 💼 **商务蓝** - 蓝/青,适合企业
- 🌙 **深邃暗** - 暗色护眼
- ⚪ **简约白** - 黑白灰,适合复杂数据

切换: 右上角圆形色块

## 页面结构

```
admin-h5/
├── index.html              # 根(自动跳登录)
├── css/
│   ├── theme.css           # 主题变量
│   └── layout.css          # 布局 + 组件
├── js/
│   ├── request.js          # http 封装(自动带 token)
│   ├── app.js              # App 工具(toast/modal/format/theme)
│   ├── router.js           # 侧边栏 + 顶栏
│   └── layout.js           # 登录守卫
└── pages/
    ├── login/login.html
    ├── dashboard/dashboard.html
    ├── chat/
    │   ├── config.html     # 聊天配置
    │   └── history.html    # 聊天记录
    ├── history/behavior.html  # 行为回溯
    ├── config/api.html     # 接口配置
    ├── orders/orders.html
    ├── goods/goods.html
    ├── employees/employees.html
    └── risk/risk.html
```

## 动态配置

**聊天配置**(`/pages/chat/config.html`):
- 欢迎语(支持富文本 + 变量)
- 快捷回复模板
- 关键词自动回复
- 转接规则
- 用户黑名单

**接口配置**(`/pages/config/api.html`):
- 微信支付(AppID/MchId/Key/证书)
- 短信(AccessKey/SecretKey/模板)
- 地图(腾讯/高德/百度)
- AI 大模型(OpenAI/Qwen/DeepSeek)
- 云存储(COS/OSS/MinIO)
- 风控数据(手机号/身份证/银行卡)
- 业务参数(佣金/提现/订单/风控)

## 主题切换实现

`css/theme.css` 用 CSS 变量,4 套主题都是覆盖变量。JS:
```js
App.setTheme('dark');   // 'sakura'|'blue'|'dark'|'plain'
```
存 localStorage,刷新保留。

## 部署

Spring Boot 默认 `classpath:/admin-h5/`, 启动后:
- `http://localhost:8080/` → 登录页
- `http://localhost:8080/admin` → Dashboard
- `http://localhost:8080/pages/chat/config.html` → 聊天配置
- `http://localhost:8080/api/doc.html` → 后端 API 文档

## 依赖

无前端框架,纯原生 JS + CSS,**首屏 100KB**。
后续可换 Vue 3 + Vite,文件结构兼容。
