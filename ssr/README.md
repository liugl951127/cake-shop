# 蛋糕销售小程序 - 服务端渲染(SEO)

> 给搜索引擎爬虫用的 SSR 服务,部署到你自己的服务器(腾讯云/阿里云/任何 Node 主机)。
> 微信云开发本身不跑 SSR,所以这是独立服务。

## 为什么需要 SSR?

- 微信小程序内容**搜索引擎爬不到**,搜不到你的商品
- SSR 把商品详情、分类、首页 HTML 化,Google/百度可以收录
- 提升 SEO 排名,免费自然流量

## 路由

| 路径 | 说明 |
|------|------|
| `GET /` | 首页(轮播 + 分类 + 推荐) |
| `GET /goods` | 商品列表(支持 `?category=xxx&keyword=xxx`) |
| `GET /goods/:id` | 商品详情(含 JSON-LD 结构化数据) |
| `GET /category/:id` | 分类页 |
| `GET /sitemap.xml` | 站点地图 |
| `GET /robots.txt` | 爬虫规则 |

## 部署

### 1. 安装依赖
```bash
cd ssr
cp .env.example .env  # 改配置
npm install
```

### 2. 配置云开发 HTTP 触发器(可选,推荐)

在云开发控制台 -> 云函数 -> 给需要的函数启用 HTTP 触发器
(需要用到的: getCmsBanners, getCategories, getGoods, getGoodsDetail)

把 `.env` 里的 `CLOUD_BASE_URL` 填入:
```
CLOUD_BASE_URL=https://你的环境ID.ap-shanghai.app.tcloudbase.com
```

### 3. 启动开发
```bash
npm run dev
```

### 4. 部署到服务器

**方案 A: PM2 (推荐)**
```bash
npm install -g pm2
npm run pm2
pm2 save
pm2 startup  # 开机自启
```

**方案 B: 直接 node**
```bash
NODE_ENV=production node src/app.js
```

**方案 C: Docker**
```bash
docker build -t cake-ssr .
docker run -d -p 3000:3000 --env-file .env cake-ssr
```

### 5. Nginx 反向代理 + HTTPS
```nginx
server {
  listen 443 ssl;
  server_name www.example.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 缓存策略

| 资源 | TTL | 说明 |
|------|-----|------|
| 首页数据 | 60s | 频繁更新 |
| 分类列表 | 60s | 频繁更新 |
| 商品详情 | 5min | 变化少 |
| 静态资源 | 7d | 浏览器缓存 |

支持 Redis 集群(配置 `REDIS_URL`),降级 LRU 内存缓存。

## SEO 优化

- ✅ 完整 meta 标签(title/description/keywords)
- ✅ Open Graph(分享到 Twitter/Facebook 显示)
- ✅ Twitter Card
- ✅ JSON-LD 结构化数据(Google 富媒体:商品、价格、评分)
- ✅ Sitemap.xml
- ✅ Robots.txt
- ✅ Canonical URL
- ✅ 移动端响应式
- ✅ 微信内唤起小程序(`wx.miniProgram.navigateTo`)

## 降级策略

未配置 `CLOUD_BASE_URL` 时,SSR 走 `fallback.js` 静态演示数据,服务**不会崩溃**,适合本地开发或 Demo 部署。

## 监控

```bash
# 健康检查
curl http://localhost:3000/sitemap.xml

# PM2 监控
pm2 monit

# 日志
pm2 logs cake-shop-ssr
```
