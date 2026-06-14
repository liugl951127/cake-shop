// getSeckill - 秒杀详情
const { cloud, ok, fail } = require('../common/index.js');

exports.main = async (event) => {
  const { id } = event;
  if (!id) return fail('id 必填');
  const db = cloud.database();
  const sk = await db.collection('seckill').doc(id).get();
  if (!sk.data) return fail('活动不存在', -404);
  const s = sk.data;
  const now = Date.now();

  let state = 'pending';
  if (now >= s.startTime && now < s.endTime) state = 'ongoing';
  else if (now >= s.endTime) state = 'ended';

  return ok({ ...s, state, currentTime: now });
};
