// getFullReduce - 当前生效的满减活动
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const res = await db.collection('promos')
    .where({
      type: 'full_reduce',
      status: 1,
      startTime: _.lte(now),
      endTime: _.gte(now)
    })
    .orderBy('minAmount', 'asc')
    .get();
  return ok(res.data);
};
