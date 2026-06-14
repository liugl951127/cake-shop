// getSeckillList - 秒杀活动列表(带状态)
const { cloud, ok } = require('../common/index.js');

exports.main = async (event) => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  const res = await db.collection('seckill').where({ status: 1 })
    .orderBy('startTime', 'asc')
    .limit(20)
    .get();

  return ok(res.data.map(s => {
    let state = 'pending'; // 未开始
    if (now >= s.startTime && now < s.endTime) state = 'ongoing'; // 进行中
    else if (now >= s.endTime) state = 'ended'; // 已结束
    return { ...s, state, currentTime: now };
  }));
};
