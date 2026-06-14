# 🎂 甜心蛋糕 - 微信小程序

一套完整可上线的**蛋糕销售微信小程序**,基于微信云开发,无需购买服务器,无需备案域名。

## ✨ 功能特性

### 用户端
- 🏠 **首页** - 轮播图、分类金刚区、公告、限时秒杀、推荐商品
- 📦 **分类页** - 左侧分类侧栏、右侧商品瀑布流、支持关键词搜索
- 🍰 **商品详情** - 多图轮播、规格选择(SKU)、数量加减、收藏、加入购物车、立即购买
- 🛒 **购物车** - 多选管理、批量结算、本地缓存
- 📋 **订单** - 提交订单、地址选择、备注、送达时间;订单状态追踪(待付款/已付款/制作中/配送中/已完成)
- 💰 **支付** - 微信支付集成(演示模式可跑通)
- 📍 **地址管理** - 增删改查、默认地址、地区选择
- ♥ **我的收藏** - 收藏/取消收藏、商品列表
- 👤 **个人中心** - 订单状态快速入口、客服、关于

### 管理端(嵌入小程序)
- 🛠 **商品管理** - 上传商品图、编辑信息、上下架
- 📋 **订单管理** - 全局订单查看、状态流转(已付款→制作中→配送中→已完成)

### 技术栈
- **前端**: 微信小程序原生 + ES6
- **后端**: 微信云开发(云函数 + 云数据库 + 云存储)
- **支付**: 微信支付(云开发模式)

---

## 🚀 快速开始(3 步上线)

### ⚡ 你只需要改一个 appid

### 1️⃣ 注册微信小程序账号

1. 访问 https://mp.weixin.qq.com/ 注册一个小程序账号
2. 记下你的 **AppID**(在小程序后台 -> 开发 -> 开发管理 -> 开发设置)

### 2️⃣ 修改 appid

打开 `miniprogram/project.config.json`,把:
```json
"appid": "touristappid000000"
```
改成:
```json
"appid": "wx你的实际appid"
```

**只改这一行就够了。**

### 3️⃣ 开通云开发 & 部署

1. 微信开发者工具导入本项目(选择 `miniprogram` 目录)
2. 点击工具栏的"云开发"按钮 -> 开通云开发(免费版够用)
3. 创建云开发环境,**记下环境 ID**(形如 `cloud-abc123`)
4. 打开 `miniprogram/app.js`,把 `cloudEnvId: 'your-cloud-env-id'` 改成你的环境 ID:
   ```js
   cloudEnvId: 'cloud-abc123',  // ← 改这里
   ```
5. **上传云函数**: 右键 `cloudfunctions` 目录 -> 上传并部署:云端安装依赖(逐个上传,或使用云函数批量上传)
6. **初始化数据库**: 在云开发控制台 -> 云函数 -> 找到 `initData` -> 测试,传入 `{}` -> 执行(会自动灌入演示数据)
7. **配置数据库权限**: 参考 `docs/数据库集合权限.md`
8. 完成!预览/真机调试/提交审核,就能用了 🎉

---

## 📁 目录结构

```
cake-shop/
├── miniprogram/                 # 小程序前端
│   ├── app.js / app.json / app.wxss
│   ├── project.config.json      # ⭐ 改 appid 就改这里
│   ├── sitemap.json
│   ├── pages/                   # 页面
│   │   ├── index/               # 首页
│   │   ├── goods/               # 分类列表
│   │   ├── detail/              # 商品详情
│   │   ├── cart/                # 购物车
│   │   ├── order/               # 订单相关
│   │   │   ├── order.wxml       # 提交订单
│   │   │   ├── list/            # 订单列表
│   │   │   └── detail/          # 订单详情
│   │   ├── address/             # 地址管理
│   │   ├── my/                  # 个人中心
│   │   ├── favor/               # 收藏
│   │   ├── login/               # 登录
│   │   ├── webview/             # 内嵌网页
│   │   └── admin/               # 管理后台
│   │       ├── goods/           # 商品管理
│   │       ├── order/           # 订单管理
│   │       └── edit/            # 商品编辑
│   ├── components/              # 组件
│   │   └── goods-card/
│   ├── utils/                   # 工具
│   │   ├── request.js           # 云函数统一调用
│   │   ├── auth.js              # 鉴权
│   │   ├── cart.js              # 本地购物车
│   │   └── util.js              # 工具函数
│   └── images/                  # 图片资源(tabbar 图标)
│
├── cloudfunctions/              # 云函数后端
│   ├── common/                  # 公共模块
│   ├── login/                   # 登录
│   ├── getCategories/           # 获取分类
│   ├── getGoods/                # 获取商品列表
│   ├── getGoodsDetail/          # 商品详情
│   ├── addAddress/              # 新增地址
│   ├── getAddress/              # 地址列表
│   ├── updateAddress/           # 更新地址
│   ├── deleteAddress/           # 删除地址
│   ├── setDefaultAddress/       # 设为默认地址
│   ├── addOrder/                # 下单
│   ├── getOrders/               # 订单列表
│   ├── cancelOrder/             # 取消订单
│   ├── confirmReceive/          # 确认收货
│   ├── payCallback/             # 支付回调
│   ├── addFavorite/             # 收藏
│   ├── removeFavorite/          # 取消收藏
│   ├── getFavorites/            # 收藏列表
│   ├── adminAddGoods/           # [管理]新增商品
│   ├── adminUpdateGoods/        # [管理]更新商品
│   ├── adminDeleteGoods/        # [管理]下架商品
│   ├── adminGetOrders/          # [管理]订单列表
│   ├── adminUpdateOrder/        # [管理]更新订单
│   ├── addCategory/             # [管理]新增分类
│   ├── uploadFile/              # 文件上传
│   └── initData/                # 初始化数据(灌入演示数据)
│
├── docs/
│   ├── 数据库集合权限.md         # 数据库配置说明
│   └── 部署指南.md              # 详细部署步骤
│
└── README.md                    # 本文件
```

---

## 🛠 后端云函数清单

| 名称 | 说明 | 鉴权 |
|------|------|------|
| login | 登录/注册,获取 openid | - |
| getCategories | 获取分类列表 | - |
| getGoods | 商品列表(支持分类/搜索/推荐) | - |
| getGoodsDetail | 商品详情 | - |
| addAddress / updateAddress / deleteAddress | 地址 CRUD | 需登录 |
| getAddress | 地址列表 | 需登录 |
| setDefaultAddress | 设为默认地址 | 需登录 |
| addOrder | 下单(校验库存、扣减库存) | 需登录 |
| getOrders | 我的订单 | 需登录 |
| cancelOrder | 取消订单(恢复库存) | 需登录 |
| confirmReceive | 确认收货 | 需登录 |
| payCallback | 支付成功回调 | 需登录 |
| addFavorite / removeFavorite / getFavorites | 收藏 CRUD | 需登录 |
| adminAddGoods / adminUpdateGoods / adminDeleteGoods | 商品管理 | 需管理员 |
| adminGetOrders / adminUpdateOrder | 订单管理 | 需管理员 |
| addCategory | 分类管理 | 需管理员 |
| initData | 初始化演示数据 | - |

---

## 🎯 关键配置点(后期只需改这些)

| 位置 | 内容 | 何时改 |
|------|------|------|
| `miniprogram/project.config.json` | `appid` | **必改,首次部署** |
| `miniprogram/app.js` | `cloudEnvId` | 开通云开发后 |
| `cloudfunctions/initData/index.js` | 演示数据 | 想换种子内容时 |
| 微信小程序后台 | 服务器域名 / 业务域名 | 接入支付、分享外链时 |

---

## 💳 接入真实微信支付

1. 申请微信支付商户号 https://pay.weixin.qq.com
2. 小程序后台关联商户号
3. 在 `cloudfunctions/payCallback` 中接入 `cloud.cloudPay` 模块(已留好接口)
4. 前端 `pages/order/order.js` 的 `pay` 方法改为真实调起支付

参考文档: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/openapi/cloud-pay/

---

## 👑 设为管理员

首次运行后,云开发控制台 -> 数据库 -> `users` 集合 -> 找到自己的记录 -> 把 `isAdmin` 字段改为 `true` -> 保存

之后"我的"页面会出现「商品管理」「订单管理」入口。

---

## 🎨 自定义品牌

- **主题色**: 修改 `miniprogram/app.wxss` 的 `--primary` 变量
- **店铺名**: 修改 `miniprogram/app.json` 的 `navigationBarTitleText` 和 `app.js` 中的品牌文案
- **首页公告**: 修改 `pages/index/index.js` 的 `notice` 字段
- **金刚区图标**: 修改 `pages/index/index.js` 的 `icons` 数组
- **轮播图**: 修改 `pages/index/index.js` 的 `banners` 数组(推荐使用云存储地址)

---

## 📜 License

MIT - 你可以自由用于商业项目
