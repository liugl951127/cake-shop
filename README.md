# 🎂 甜心蛋糕 - 微信小程序 v2.0

一套**生产可用**的蛋糕销售微信小程序,基于微信云开发,真实集成微信支付。

## ✨ v2.0 新增(本次升级)

| 模块 | 内容 |
|------|------|
| 🔐 授权登录 | token 体系 + 静默自动登录 + 头像/昵称/手机号授权 |
| 💳 安全支付 | 真实微信支付(云开发 cloudPay)+ 退款 + 幂等锁 + 金额防篡改 |
| 📦 订单流程 | 7 状态机(0/1/2/3/4/5/-1/-2)+ 状态流转日志 + 配送员信息 |
| ⏰ 自动化 | 30 分钟超时自动关单 + 7 天自动确认收货(云函数定时器) |
| 📍 地址增强 | 微信地址簿导入 / 省市区三级级联 / 地图选点 / 校验 |

## ✨ 用户端功能

- 🏠 **首页** - 轮播 + 分类金刚区 + 秒杀 + 推荐
- 📦 **分类页** - 侧栏分类 + 关键词搜索
- 🍰 **商品详情** - SKU 规格 + 收藏 + 加购/立购
- 🛒 **购物车** - 多选 + 缓存
- 📋 **下单** - 地址 + 时间 + 备注 + 微信支付
- 📑 **订单** - 状态进度条 + 物流信息 + 倒计时
- 💰 **退款** - 申请 + 状态追踪
- 📍 **地址** - 增删改 + 微信导入 + 地图选点
- ♥ **收藏** + 👤 **个人中心**

## ✨ 管理端(嵌入小程序)

- 🛠 **商品管理** - 上传图 + 编辑 + 上下架
- 📋 **订单管理** - 全状态流转 + 发货表单(配送员信息)
- 👑 **管理员权限** - isAdmin 字段控制

---

## 🚀 上线只需改 3 处

| 位置 | 改什么 |
|------|------|
| `miniprogram/project.config.json` | `appid` 改成你的 |
| `miniprogram/app.js` | `cloudEnvId` 改成云开发环境 ID |
| 云开发控制台 -> 云函数 -> 环境变量 | `MCH_ID` / `MCH_KEY`(真实支付才需要) |

---

## 📁 目录结构

```
cake-shop/
├── miniprogram/                 # 小程序前端
│   ├── app.js / app.json / app.wxss
│   ├── project.config.json      # ⭐ appid
│   ├── pages/
│   │   ├── index / goods / detail / cart / login
│   │   ├── order/ (order 提交 / list 列表 / detail 详情)
│   │   ├── address/ (list 列表 / edit 编辑)
│   │   ├── my / favor / webview
│   │   └── admin/ (goods 商品管理 / order 订单管理 / edit 商品编辑)
│   ├── components/goods-card/
│   └── utils/ (request / auth / cart / util)
│
├── cloudfunctions/              # 云函数(31 个)
│   ├── common/  (index token pay orderLog formatTime)
│   ├── 登录: login / getPhone / logout
│   ├── 商品: getCategories / getGoods / getGoodsDetail
│   ├── 订单: addOrder / getOrders / getOrderDetail
│   │       / cancelOrder / confirmReceive / refund
│   ├── 支付: payCallback
│   ├── 地址: getAddress / addAddress / updateAddress
│   │       / deleteAddress / setDefaultAddress / getRegions
│   ├── 收藏: addFavorite / removeFavorite / getFavorites
│   ├── 管理: adminAddGoods / adminUpdateGoods / adminDeleteGoods
│   │       / adminGetOrders / adminUpdateOrder / adminShipOrder
│   │       / addCategory / uploadFile
│   ├── 定时: autoCloseOrders / autoConfirmReceive
│   └── 数据: initData / initRegions
│
├── docs/
│   ├── 部署指南.md
│   └── 数据库集合权限.md
│
└── README.md
```

---

## 📊 订单状态机

```
0 待付款 ──(支付成功)──> 1 已付款 ──(商家开始制作)──> 2 制作中
                                                       │
                            ┌──────────────────────────┘
                            ▼
3 配送中 ──(用户确认收货)──> 4 已完成

任意状态(1/2/3) ──(用户申请退款)──> 5 退款中 ──(退款成功)──> -2 已退款
0 待付款 ──(超时/手动取消)──> -1 已取消
```

每次状态变更写入 `orderLogs` 集合,可在前端「订单详情 - 订单跟踪」看到。

---

## 🛡️ 安全设计

| 风险点 | 防护 |
|------|------|
| token 伪造 | HMAC-SHA256 签名,7 天过期 |
| 金额篡改 | 后端复算校验,差额>0.01 拒绝 |
| 重复支付 | `payCallback` 幂等处理 |
| 库存超卖 | 乐观更新,失败回滚 |
| 状态机跳跃 | TRANSITIONS 白名单 + 校验 |
| 重复下单 | 5 秒内同 openid 幂等锁 |
| 越权操作 | 每个云函数 auth 中间件校验 |
| 支付回调伪造 | 校验 outTradeNo 对应订单存在 + 金额一致 |

---

## 📜 License

MIT
