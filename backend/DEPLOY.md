# 部署与对接架构

## 3 种对接方式

本项目支持 **3 种** 小程序与后端的对接方式,按场景选择:

| 方式 | 链路 | 适用 | 优势 | 劣势 |
|------|------|------|------|------|
| **直连后端** | 小程序 → Spring Boot | **主流电商** | 链路短,易调试,无云函数费用 | 需备案 HTTPS |
| **内部 RPC** | 云函数/Vue 后台 → Spring Boot (X-Internal-Token) | 跨服务/云函数中转 | 简单 token 鉴权,无 JWT 复杂度 | 仅内网/同集群 |
| **云函数中转** | 小程序 → 180 个云函数 → Spring Boot | 免备案/复杂业务 | 无需备案域名 | 多一跳,180 云函数难维护 |

**本项目推荐**: 小程序**直连后端**,管理后台 + 云函数走**内部 RPC**。

## 架构图

```
┌────────────────────────────────────────────────────┐
│  用户(微信客户端)                                  │
└──────────────┬─────────────────────────────────────┘
               │ wx.request + X-Openid + X-Login-Token
               │ Referer: https://servicewechat.com/{APPID}/...
               ↓
┌────────────────────────────────────────────────────┐
│  Spring Boot (api.cakeshop.com)                    │
│  ────────────────────────────────────────────────── │
│  Filter 链:                                        │
│    1. InternalRpcFilter    /api/internal/**       │
│    2. MiniProgramRefererFilter 校验 Referer        │
│    3. MiniProgramAuthFilter  X-Openid + X-Login-Token│
│    4. JwtAuthFilter        Authorization: Bearer   │
│  Controller:                                       │
│    /api/wx/session       code → openid+token      │
│    /api/wx/session/logout 清 token                  │
│    /api/...              业务接口(需 openid)       │
│    /api/admin/...        后台管理(需 JWT admin)    │
│    /api/internal/...     内部 RPC(需 X-Internal-Token)│
└──────────────┬─────────────────────────────────────┘
               │ JDBC / Redis
               ↓
┌────────────────────────────────────────────────────┐
│  MySQL 8 + Redis 7                                 │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  商家浏览器 (admin-vue)                            │
└──────────────┬─────────────────────────────────────┘
               │ fetch + Authorization: Bearer {JWT}
               │ (vue.config.js proxy /api → 8080)
               ↓
              同上 Spring Boot

┌────────────────────────────────────────────────────┐
│  云函数(可选,复杂业务)                              │
└──────────────┬─────────────────────────────────────┘
               │ fetch + X-Internal-Token
               ↓
              同上 Spring Boot (/api/internal/...)
```

## 配置

### 1. 微信小程序后台 (mp.weixin.qq.com)

#### 1.1 拿到 AppID

注册小程序 → 开发管理 → 开发设置 → 复制 **AppID(小程序 ID)**

#### 1.2 配置合法域名

开发管理 → 开发设置 → 服务器域名:

```
request 合法域名:
  https://api.cakeshop.com

uploadFile 合法域名:
  https://api.cakeshop.com

downloadFile 合法域名:
  https://api.cakeshop.com
```

> ⚠️ 必须是 **HTTPS**,且 ICP 备案。

#### 1.3 关闭 IP 白名单(可选)

开发管理 → 开发设置 → 关闭 "IP 白名单"(开发期方便)

### 2. 后端环境变量

```bash
# application-prod.yml 读取的环境变量

# 必填: 微信小程序
export WX_APPID=wx1234567890abcdef
export WX_SECRET=xxxxxxxxxxxxxxxxxxxx  # AppSecret(在微信后台)

# 必填: 内部 RPC token(自己生成,32+ 字符)
export INTERNAL_RPC_TOKEN=$(openssl rand -hex 32)

# 必填: MySQL
export MYSQL_HOST=rm-xxxx.mysql.rds.aliyuncs.com
export MYSQL_PORT=3306
export MYSQL_DB=cake_shop
export MYSQL_USER=cake_shop
export MYSQL_PASSWORD=xxxxxxxx

# 必填: Redis
export REDIS_HOST=r-xxxx.redis.rds.aliyuncs.com
export REDIS_PORT=6379
export REDIS_PASSWORD=xxxxxxxx
export REDIS_DB=0

# 推荐: JWT
export JWT_SECRET=$(openssl rand -hex 32)
```

### 3. 启动后端

```bash
cd backend
mvn clean package -DskipTests

# 启动
java -jar target/cakeshop-backend.jar \
  --spring.profiles.active=prod \
  --server.port=8080
```

### 4. 配置 nginx (推荐)

```nginx
server {
  listen 443 ssl;
  server_name api.cakeshop.com;

  ssl_certificate     /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;

  # 微信小程序 API
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# HTTP → HTTPS 重定向
server {
  listen 80;
  server_name api.cakeshop.com;
  return 301 https://$host$request_uri;
}
```

### 5. 启动 Vue 后台

```bash
cd admin-vue
cp .env.example .env.production
# 编辑 .env.production
#   VITE_API_BASE=https://api.cakeshop.com/api
#   VITE_RPC_TOKEN=xxx (跟后端 INTERNAL_RPC_TOKEN 一致)

npm install
npm run build
# 产物 dist/ 部署到 nginx
```

### 6. 微信开发者工具

```bash
# 1. 导入项目
#    项目目录: 选 miniprogram/
#    AppID:    填你的 wxAppid
#    项目名称:  甜心蛋糕

# 2. 关闭域名校验 (开发期)
#    详情 → 本地设置 → 不校验合法域名

# 3. 预览
#    点 "预览" → 扫码 → 真机体验

# 4. 真机调试
#    点 "真机调试" → 扫码 → vConsole 看日志
```

## 鉴权流程

### A. 小程序登录

```
1. 小程序冷启动
   ↓
2. wx.login() 拿 code
   ↓
3. POST /api/wx/session  body: { code, inviterCode? }
   ↓
4. 后端:
   a) 调 https://api.weixin.qq.com/sns/jscode2session 换 openid
   b) 查/建 user (此项目简化: openid 哈希当 userId)
   c) 生成 32 字节随机 token,存 Redis (TTL 24h)
   d) 返回 { openid, token, userId, isNew }
   ↓
5. 小程序存 wx.setStorageSync('openid', openid) + 'token'
   ↓
6. 后续请求: header['X-Openid'] = openid, header['X-Login-Token'] = token
   ↓
7. MiniProgramAuthFilter 校验 token → 注入 SecurityContext
```

### B. 商家后台登录

```
1. Vue 登录页: username + password
   ↓
2. POST /api/auth/login
   ↓
3. 后端校验 → 生成 JWT (含 openid/userId/role)
   ↓
4. 返回 { token, userId, role }
   ↓
5. localStorage.setItem('__admin_token__', token)
   ↓
6. 后续请求: Authorization: Bearer {JWT}
   ↓
7. JwtAuthFilter 解析 → 注入 SecurityContext
```

### C. 内部 RPC(云函数调用)

```
1. 云函数 / Vue 后台 调后端
   ↓
2. URL: /api/internal/...
   ↓
3. Header: X-Internal-Token: {INTERNAL_RPC_TOKEN}
   ↓
4. InternalRpcFilter 校验 → 注入 ROLE_INTERNAL + ROLE_ADMIN
   ↓
5. 业务可访问任何 /api/internal/ 下的接口
```

### D. 微信小程序 Referer 校验(防外网)

```
微信小程序请求:
  Referer: https://servicewechat.com/wxAPPID/16/page-frame.html

外网直接 curl:
  Referer: (空) 或 https://example.com/

MiniProgramRefererFilter:
  - Referer 必须以 https://servicewechat.com/ 开头
  - Referer 必须包含配置的 appid
  - 不通过 → 403 Forbidden
```

## 安全检查清单

- [ ] 微信小程序 `referer` 校验已开(`mp-referer.enabled=true`)
- [ ] 内部 RPC token 改了(`INTERNAL_RPC_TOKEN` 是 32+ 随机串)
- [ ] AppSecret 走环境变量,不写代码
- [ ] JWT secret 走环境变量(`JWT_SECRET`)
- [ ] MySQL/Redis 密码走环境变量
- [ ] HTTPS 证书有效(Let's Encrypt 90 天,记得续期)
- [ ] 后端 ignore-urls 严格(只放过 `/api/wx/session` 等)
- [ ] admin-vue 部署到独立域名(不能跟小程序同源)
- [ ] 云函数里不写 hard-coded 业务逻辑(只做中转)

## 故障排查

### 401 Unauthorized

- 小程序: 检查 `X-Openid` + `X-Login-Token` 头
- 后台: 检查 `Authorization: Bearer` 头
- 内部 RPC: 检查 `X-Internal-Token` 头

### 403 Forbidden

- Referer 校验: 微信开发者工具里 "不校验合法域名" 可能影响
  - 真机: Referer 正常
  - 开发者工具: Referer 可能为空 → 关闭 referer 校验开发

### wx.login 失败

- AppID / AppSecret 配错
- 微信后台 "AppSecret" 重置
- 后端调 jscode2session 网络问题

### 跨域问题

- 后端 `SecurityConfig` 允许 CORS(已配 `*`)
- nginx 加 `Access-Control-Allow-Origin` 头

## 性能调优

- 启用 HTTP/2 (nginx)
- 启用 Gzip (nginx `gzip on;`)
- 后端: `server.tomcat.max-threads=200` (已配)
- Redis 连接池: `lettuce.pool.max-active=50` (已配)
- 数据库连接池: `druid.max-active=20` (dev) / `50` (prod)

## 监控

- 微信小程序后台 → 运营分析
- 微信小程序后台 → 性能监控
- Spring Boot Actuator: `/actuator/health` `/actuator/metrics`
- Redis: `redis-cli info` `redis-cli monitor`
- MySQL: `show processlist;` `show status;`
