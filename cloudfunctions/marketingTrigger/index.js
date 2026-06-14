// marketingTrigger - 营销自动化引擎
// 触发器: 生日 / 沉默 / 流失 / 高价值 / 首单
// 由定时器每日 8:00 跑
// 每条规则: 圈人 → 选品 → 发券 → 推送

const { cloud, ok } = require('../common/index.js');

const RULES = [
  {
    code: 'BIRTHDAY',
    name: '生日礼',
    description: '用户生日前 7 天推送专属券',
    async run(db, _) {
      const now = new Date();
      const y = now.getFullYear();
      const sent = [];

      // 找生日前 7 天的用户
      const all = await db.collection('users').limit(1000).get();
      for (const u of all.data) {
        if (!u.birthday) continue;
        // birthday 是 YYYY-MM-DD
        const m = u.birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) continue;
        const md = `${m[2]}-${m[3]}`;
        const target = new Date(`${y}-${md}`);
        const diff = Math.ceil((target - now) / 86400000);
        if (diff < 0 || diff > 7) continue;

        // 是否今年已发
        if (u.lastBirthdayGiftYear === y) continue;

        // 发生日券
        const couponTpl = await db.collection('coupons').where({ type: 4, status: 1 }).limit(1).get();
        if (!couponTpl.data[0]) continue;
        await db.collection('couponUsers').add({
          data: {
            _openid: u.openid, _userId: u._id,
            couponId: couponTpl.data[0]._id, status: 0,
            receiveTime: Date.now(), expireTime: Date.now() + 30 * 86400000,
            fromBirthday: true
          }
        }).catch(() => {});

        // 推送
        await sendMessage(u, {
          title: '🎂 提前祝您生日快乐!',
          content: `专属生日礼已发放,有效期 30 天`,
          page: '/package-user/pages/coupon/center/center'
        });

        // 标记已发
        await db.collection('users').doc(u._id).update({
          data: { lastBirthdayGiftYear: y }
        });
        sent.push(u._id);
      }
      return { sent: sent.length };
    }
  },
  {
    code: 'SILENT',
    name: '沉默唤醒',
    description: '14-30 天未活跃,送 5 元无门槛券',
    async run(db, _) {
      const now = Date.now();
      const silent14 = now - 14 * 86400000;
      const silent30 = now - 30 * 86400000;
      const silent60 = now - 60 * 86400000;

      const list = await db.collection('users')
        .where({ lastLoginTime: _.lte(silent14) })
        .limit(500)
        .get();

      const sent = [];
      for (const u of list.data) {
        // 跳过流失(>60天)和太新的
        if (u.lastLoginTime < silent60) continue;
        if (u.lastLoginTime > silent14) continue;
        if (u.lastSilentGiftTime && (now - u.lastSilentGiftTime) < 30 * 86400000) continue;

        const couponTpl = await db.collection('coupons').where({ type: 1, minAmount: 0, status: 1 }).limit(1).get();
        if (!couponTpl.data[0]) continue;
        await db.collection('couponUsers').add({
          data: {
            _openid: u.openid, _userId: u._id,
            couponId: couponTpl.data[0]._id, status: 0,
            receiveTime: now, expireTime: now + 7 * 86400000,
            fromSilent: true
          }
        }).catch(() => {});

        await sendMessage(u, {
          title: '好久不见,想念您了 💝',
          content: '送您一张无门槛券,快回来看看新品',
          page: '/package-user/pages/coupon/center/center'
        });
        await db.collection('users').doc(u._id).update({
          data: { lastSilentGiftTime: now }
        });
        sent.push(u._id);
      }
      return { sent: sent.length };
    }
  },
  {
    code: 'LOST',
    name: '流失挽回',
    description: '60+ 天未登录,发短信 + 大额券',
    async run(db, _) {
      const now = Date.now();
      const lost60 = now - 60 * 86400000;

      const list = await db.collection('users')
        .where({ lastLoginTime: _.lte(lost60) })
        .limit(200)
        .get();

      const sent = [];
      for (const u of list.data) {
        if (u.lastLostGiftTime && (now - u.lastLostGiftTime) < 90 * 86400000) continue;

        // 30 元无门槛券
        const couponTpl = await db.collection('coupons').where({ type: 5, status: 1 }).limit(1).get();
        if (couponTpl.data[0]) {
          await db.collection('couponUsers').add({
            data: {
              _openid: u.openid, _userId: u._id,
              couponId: couponTpl.data[0]._id, status: 0,
              receiveTime: now, expireTime: now + 14 * 86400000,
              fromLost: true
            }
          }).catch(() => {});
        }

        await sendMessage(u, {
          title: '🎁 专属回归礼已送达',
          content: '30 元券 + 满减,错过这次再等一年',
          page: '/package-user/pages/coupon/center/center'
        });
        await db.collection('users').doc(u._id).update({
          data: { lastLostGiftTime: now }
        });
        sent.push(u._id);
      }
      return { sent: sent.length };
    }
  },
  {
    code: 'HIGH_VALUE',
    name: '高价值 VIP 关怀',
    description: '累计消费 ≥ 1000 的用户,发专属福利',
    async run(db, _) {
      const list = await db.collection('users')
        .where({ totalSpend: _.gte(1000) })
        .limit(200)
        .get();

      const sent = [];
      const monthKey = new Date().toISOString().slice(0, 7);  // YYYY-MM
      for (const u of list.data) {
        if (u.lastHighValueGiftMonth === monthKey) continue;

        // VIP 券
        const couponTpl = await db.collection('coupons').where({ type: 6, status: 1 }).limit(1).get();
        if (couponTpl.data[0]) {
          await db.collection('couponUsers').add({
            data: {
              _openid: u.openid, _userId: u._id,
              couponId: couponTpl.data[0]._id, status: 0,
              receiveTime: Date.now(), expireTime: Date.now() + 30 * 86400000,
              fromVip: true
            }
          }).catch(() => {});
        }

        await sendMessage(u, {
          title: '👑 VIP 专属福利',
          content: '本月专属券已发放,感谢您一直陪伴',
          page: '/package-user/pages/coupon/center/center'
        });
        await db.collection('users').doc(u._id).update({
          data: { lastHighValueGiftMonth: monthKey }
        });
        sent.push(u._id);
      }
      return { sent: sent.length };
    }
  },
  {
    code: 'FIRST_ORDER',
    name: '首单激励',
    description: '注册 3 天未下单,送 10 元券',
    async run(db, _) {
      const now = Date.now();
      const reg3 = now - 3 * 86400000;

      const list = await db.collection('users')
        .where({
          createTime: _.lte(reg3),
          orderCount: _.or([0, undefined])
        })
        .limit(500)
        .get();

      const sent = [];
      for (const u of list.data) {
        if (u.lastFirstOrderGiftTime) continue;

        // 检查是否真没下单
        const cnt = await db.collection('orders').where({ _userId: u._id }).count();
        if (cnt.total > 0) continue;

        const couponTpl = await db.collection('coupons').where({ type: 1, minAmount: 50, status: 1 }).limit(1).get();
        if (couponTpl.data[0]) {
          await db.collection('coupons').add({}).catch(() => {});
          await db.collection('couponUsers').add({
            data: {
              _openid: u.openid, _userId: u._id,
              couponId: couponTpl.data[0]._id, status: 0,
              receiveTime: now, expireTime: now + 14 * 86400000,
              fromFirst: true
            }
          }).catch(() => {});
        }

        await sendMessage(u, {
          title: '新人专属福利',
          content: '10 元无门槛券已发放,快下单试试',
          page: '/package-user/pages/coupon/center/center'
        });
        await db.collection('users').doc(u._id).update({
          data: { lastFirstOrderGiftTime: now }
        });
        sent.push(u._id);
      }
      return { sent: sent.length };
    }
  }
];

// 推消息(优先订阅消息,失败走站内信)
async function sendMessage(user, msg) {
  const db = cloud.database();
  // 站内信
  await db.collection('messages').add({
    data: {
      toOpenid: user.openid,
      toUserId: user._id,
      type: 'marketing',
      title: msg.title,
      content: msg.content,
      page: msg.page,
      read: false,
      createTime: Date.now()
    }
  }).catch(() => {});

  // 订阅消息(用户授权过才发得出去)
  if (user.subscribeTemplateId) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: user.openid,
        templateId: user.subscribeTemplateId,
        page: msg.page,
        data: {
          thing1: { value: msg.title.slice(0, 17) },
          thing2: { value: msg.content.slice(0, 17) }
        }
      });
    } catch (e) {}
  }
}

exports.main = async (event) => {
  const { ruleCode = '', dryRun = false } = event;
  const db = cloud.database();
  const _ = db.command;

  const rules = ruleCode ? RULES.filter(r => r.code === ruleCode) : RULES;
  const results = [];
  for (const r of rules) {
    try {
      const t0 = Date.now();
      const r2 = dryRun ? { sent: 0, dryRun: true } : await r.run(db, _);
      results.push({
        code: r.code,
        name: r.name,
        description: r.description,
        ...r2,
        duration: Date.now() - t0
      });
      // 写日志
      await db.collection('marketingLogs').add({
        data: {
          ruleCode: r.code,
          ruleName: r.name,
          result: r2,
          dryRun,
          createTime: Date.now()
        }
      }).catch(() => {});
    } catch (e) {
      results.push({ code: r.code, name: r.name, error: e.message });
    }
  }

  return ok({ rules: results, totalDuration: results.reduce((s, r) => s + (r.duration || 0), 0) });
};
