# 甜心蛋糕 - Vue 3 后台管理

## 🚀 快速启动 (Windows)

### 一键启动
双击 `start-windows.bat`

### 手动启动

```cmd
:: 1. 安装依赖(首次)
npm install

:: 2. 启动开发服务器
npm run dev
```

启动后访问: **http://localhost:8081**

默认账号: `admin` / `123456`

## 📋 前提条件

| 软件 | 版本 | 用途 |
|------|------|------|
| **Node.js** | 18+ | 运行 Vite |
| **npm** | 9+ | 包管理 |
| **Spring Boot 后端** | 已启动 | API 来源 |

## 🔧 配置文件

`vite.config.js`:
- 端口:`8081`
- API 代理:`/api` → `http://localhost:8080`

如要修改后端地址,改 `vite.config.js` 的 `proxy.target`。

## 🛠️ 技术栈

- **Vue 3** (Composition API + `<script setup>`)
- **Vite 5** (开发服务器 + 构建)
- **Vue Router 4** (路由)
- **Pinia** (状态管理)
- **Element Plus** (UI 组件库)
- **Axios** (HTTP)

## 📁 目录结构

```
admin-vue/
├── index.html              # 入口
├── vite.config.js          # Vite 配置
├── package.json
├── start-windows.bat       # Windows 一键启动
└── src/
    ├── main.js             # 应用入口
    ├── App.vue             # 根组件
    ├── router/             # 路由
    │   └── index.js
    ├── api/                # API 封装
    │   └── index.js
    ├── views/              # 页面
    │   ├── Login.vue
    │   ├── Layout.vue      # 主布局(侧边栏+顶栏)
    │   ├── Dashboard.vue
    │   ├── Goods.vue
    │   ├── Orders.vue
    │   ├── Members.vue
    │   ├── Marketing.vue
    │   ├── Chat.vue
    │   ├── Finance.vue
    │   └── Monitor.vue
    └── assets/
        └── main.css        # 全局样式
```

## 🎨 主题

- 主色:indigo (`#6366f1`)
- 渐变:`linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #818cf8 100%)`
- 圆角:大圆角(12-16px)

## 🔌 API 对接

已对接 Spring Boot 后端 v28.0 的 8 大模块:

| 模块 | 路径 |
|------|------|
| 仪表盘 | `/api/v1/admin/dashboard/overview` |
| 商品 | `/api/v1/admin/goods/*` |
| 订单 | `/api/v1/admin/orders/*` |
| 会员 | `/api/v1/admin/members/*` |
| 营销 | `/api/v1/admin/marketing/{type}/*` |
| 客服 | `/api/v1/admin/chat/*` |
| 财务 | `/api/v1/admin/finance/*` |
| 监控 | `/api/v1/admin/monitor/*` |

## 🐛 常见问题

### 1. 端口 8081 被占用
改 `vite.config.js` 的 `server.port`。

### 2. 后端 8080 连不上
确认 Spring Boot 已启动。Vite 会把 `/api/*` 代理到 `http://localhost:8080`。

### 3. 依赖安装慢
```cmd
npm config set registry https://registry.npmmirror.com
npm install
```

### 4. 登录失败
- 默认账号 `admin` / `123456`
- 后端需要先初始化 `users` 表 / 管理员账号
- 检查 `JWT_SECRET` 配置
