# 🎂 甜心蛋糕 - 微信小程序 v3.0

完整可上线的蛋糕销售小程序,基于微信云开发 + 微信支付,**集 8 大营销系统于一身**。

## ✨ v3.0 新增(本次升级)

| 系统 | 功能 |
|------|------|
| 👑 **会员系统** | 4 级成长值(普通/银/金/钻)+ 积分 + 每日签到 + 专属折扣 |
| 🎟️ **优惠券** | 满减/折扣/新人/运费券 + 领取中心 + 过期自动清理 |
| ⚡ **秒杀** | 限时特价 + 独立库存 + 防超卖 + 实时倒计时 |
| 👥 **拼团** | 2-5 人成团 + 团长优惠 + 24h 倒计时 + 失败自动退款 |
| 📢 **订阅消息** | 订单支付/发货/完成/退款/签到通知 |
| 🏪 **多门店** | 门店列表 + 距离推荐 + 到店自提 + 节省运费 |
| 📦 **物流查询** | 快递100 对接 + 轨迹展示 + 自动签收检测 |
| 🎁 **分享得券** | 分享好友得券/积分 + 收藏夹分组 |

## ✨ v2.0 功能(已含)

- 真实微信支付(统一下单 + 回调 + 退款)
- 订单 7 状态机 + 流转日志
- 30 分钟超时关单 + 7 天自动确认
- 完整授权登录(token 体系 + 静默登录)
- 地址增强(微信导入/级联/地图)

## ✨ v1.0 基础(已含)

- 首页/分类/详情/购物车/订单/地址/收藏/个人中心
- 商品/订单/优惠券/会员/拼团/秒杀 管理后台
- 5 个分类 + 9 个商品 + 7 个门店 演示数据

---

## 📊 订单状态机

```
0 待付款 → 1 已付款 → 2 制作中 → 3 配送中 → 4 已完成
任意已付 → 5 退款中 → -2 已退款
0 待付款 → -1 已取消(超时/手动)
```

## 📊 会员等级

| 等级 | 成长值门槛 | 折扣 | 标识 |
|------|------|------|------|
| 普通 | 0+ | 不打折 | 🌱 |
| 银卡 | 100+ | 98 折 | 🥈 |
| 金卡 | 500+ | 95 折 | 🥇 |
| 钻石 | 2000+ | 9 折 | 💎 |

消费 1 元 = 1 成长值 = 1 积分,100 积分 = 1 元抵扣

---

## 📁 项目结构

```
cake-shop/
├── miniprogram/                # 小程序前端
│   ├── pages/                  # 18 个页面
│   │   ├── index/goods/detail/cart/login/my/webview/favor
│   │   ├── order/ (order 提交 / list 列表 / detail 详情)
│   │   ├── address/ (list/edit)
│   │   ├── admin/ (goods/order/edit)
│   │   ├── member/             # 会员中心
│   │   ├── coupon/center/      # 优惠券中心
│   │   ├── seckill/             # 秒杀
│   │   ├── group/(list/detail) # 拼团
│   │   ├── store/list/          # 门店
│   │   └── logistics/           # 物流
│   ├── components/goods-card/
│   └── utils/ (request/auth/cart/util)
│
├── cloudfunctions/              # 云函数(45+)
│   ├── common/  (index token pay orderLog member coupon
│   │           formatTime subscribeMessage)
│   ├── 登录: login/getPhone/logout
│   ├── 商品: getCategories/getGoods/getGoodsDetail
│   ├── 订单: addOrder/getOrders/getOrderDetail
│   │       /cancelOrder/confirmReceive/refund
│   ├── 支付: payCallback
│   ├── 地址: getAddress/.../getRegions
│   ├── 收藏: addFavorite/.../favorGroups
│   ├── 会员: getMemberInfo/signIn
│   ├── 优惠券: getCoupons/receiveCoupon/getCouponList
│   ├── 秒杀: getSeckillList/getSeckill
│   ├── 拼团: createGroup/joinGroup/getGroupInfo
│   ├── 门店: getStores
│   ├── 物流: queryLogistics
│   ├── 分享: shareCallback
│   ├── 管理: adminAddGoods/.../adminShipOrder
│   │        /adminAddCoupon
│   ├── 定时: autoCloseOrders/autoConfirmReceive
│   │       /autoExpireCoupons/autoCloseSeckill
│   │       /autoCloseGroups
│   └── 数据: initData/initRegions/initSeckill
│              /initStores/initGroup/initCoupons
│
└── docs/ (部署指南/数据库权限)
```

---

## 🚀 上线 3 处配置

| 文件 | 配置 |
|------|------|
| `miniprogram/project.config.json` | `appid` |
| `miniprogram/app.js` | `cloudEnvId` |
| 云开发控制台 -> 云函数环境变量 | `MCH_ID` `MCH_KEY` `LOGISTICS_KEY` `LOGISTICS_CUSTOMER` |

---

## 📜 License

MIT
