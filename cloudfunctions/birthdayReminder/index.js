// birthdayReminder - 生日提醒订阅
// 1. set: 设置 / 更新生日
// 2. list: 我关注的寿星列表
// 3. cronTick: 每天早 9 点,提前 7 天推送
const { cloud, ok, fail, auth } = require('../common/index.js');

const REMIND_DAYS = 7;  // 提前几天

exports.main = async (event) => {
  const { action = 'set' } = event;

  switch (action) {
    case 'set': return setReminder(event);
    case 'list': return listReminders(event);
    case 'delete': return deleteReminder(event);
    case 'cron': return cronTick();
    default: return fail('未知 action');
  }
};

async function setReminder(event) {
  const { name, birthday, type = 'self', remindDays = REMIND_DAYS, giftPref = '' } = event;
  if (!name || !birthday) return fail('姓名 + 生日必填');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return fail('生日格式 YYYY-MM-DD');

  const db = cloud.database();
  const now = Date.now();
  const doc = {
    _openid: event._openid,
    _userId: event._userId,
    name,
    birthday,
    type,             // self/loved/friend/colleague
    remindDays: Number(remindDays) || REMIND_DAYS,
    giftPref,
    lastSentYear: 0,
    createTime: now,
    updateTime: now
  };
  const res = await db.collection('birthdayReminders').add({ data: doc });
  return ok({ id: res._id });
}

async function listReminders(event) {
  const db = cloud.database();
  const res = await db.collection('birthdayReminders')
    .where({ _userId: event._userId })
    .orderBy('createTime', 'desc')
    .get();
  // 计算距生日天数
  const today = new Date();
  const list = res.data.map(r => ({
    ...r,
    daysToBirthday: calcDaysToBirthday(r.birthday, today)
  }));
  // 排序:近的在前
  list.sort((a, b) => a.daysToBirthday - b.daysToBirthday);
  return ok(list);
}

async function deleteReminder(event) {
  const { id } = event;
  if (!id) return fail('id 必填');
  const db = cloud.database();
  const doc = await db.collection('birthdayReminders').doc(id).get();
  if (doc.data && doc.data._userId !== event._userId) return fail('无权删除', -403);
  await db.collection('birthdayReminders').doc(id).remove();
  return ok({ deleted: true });
}

// 每天早 9 点跑(由定时触发器触发)
async function cronTick() {
  const db = cloud.database();
  const today = new Date();
  const all = await db.collection('birthdayReminders').limit(1000).get();
  const year = today.getFullYear();
  let sent = 0;
  for (const r of all.data) {
    const days = calcDaysToBirthday(r.birthday, today);
    if (days > r.remindDays) continue;
    if (days < 0) continue;  // 已过
    if (r.lastSentYear === year) continue;  // 今年已发
    // 推送订阅消息
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: r._openid,
        templateId: process.env.BIRTHDAY_TEMPLATE_ID || 'birthday_reminder',
        page: '/package-promo/pages/custom/quote/quote?type=birthday',
        data: {
          name: { value: r.name },
          days: { value: String(days) },
          date: { value: r.birthday }
        }
      });
      await db.collection('birthdayReminders').doc(r._id).update({
        data: { lastSentYear: year, lastSentTime: Date.now() }
      });
      sent++;
    } catch (e) {
      console.error('[birthday] send fail', r._id, e.message);
    }
  }
  return ok({ sent });
}

function calcDaysToBirthday(birthdayStr, today) {
  const [y, m, d] = birthdayStr.split('-').map(Number);
  const year = today.getFullYear();
  let target = new Date(year, m - 1, d);
  if (target < today) target = new Date(year + 1, m - 1, d);
  const diff = target - today;
  return Math.ceil(diff / 86400000);
}
