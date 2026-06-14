// autoCloseSeckill - 定时关闭过期秒杀
const { cloud, ok } = require('../common/index.js');

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const res = await db.collection('seckill').where({
    status: 1,
    endTime: _.lt(Date.now())
  }).update({ data: { status: 2, updateTime: Date.now() } });
  return ok({ closed: res.stats.updated });
};
