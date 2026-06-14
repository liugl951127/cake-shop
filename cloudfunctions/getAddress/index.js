const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const db = cloud.database();
  const res = await db.collection('addresses')
    .where({ _openid: event._openid })
    .orderBy('isDefault', 'desc')
    .orderBy('createTime', 'desc')
    .get();
  return ok(res.data);
});
