// getAgents - 坐席列表
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { online = false, keyword = '' } = event;
  const db = cloud.database();
  const _ = db.command;
  const where = {};
  if (online) where.online = true;
  if (keyword) {
    const reg = db.RegExp({ regexp: keyword, options: 'i' });
    where.$or = [{ name: reg }, { nickName: reg }, { agentNo: reg }];
  }
  const res = await db.collection('agents').where(where).limit(50).get();
  return ok(res.data);
});
