// chatTyping - 正在输入状态(轻量,无写库,只更新内存缓存)
// 由于云函数无状态,这里用一个特殊的轻量集合做实时状态
// 实际场景:对方从 watch 监听本集合变化即可
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { sessionId, role, typing = true } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();

  // 用一个 short-lived 文档表示"谁正在输入"
  // key 设计: sessionId + role
  const docId = `${sessionId}_${role}`;
  const exist = await db.collection('chatTyping').doc(docId).get().catch(() => null);
  if (typing) {
    if (exist && exist.data) {
      await db.collection('chatTyping').doc(docId).update({
        data: { typing: true, updateTime: now }
      });
    } else {
      await db.collection('chatTyping').add({
        data: {
          _id: docId,
          sessionId, role, typing: true,
          _openid: event._openid, updateTime: now
        }
      });
    }
  } else {
    if (exist && exist.data) {
      await db.collection('chatTyping').doc(docId).remove();
    }
  }
  return ok();
});
