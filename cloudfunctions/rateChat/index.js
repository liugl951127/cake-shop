// rateChat - 评价客服会话
// score: 1-5 星
// tags: ['态度好','回复快','专业'] 等
// comment: 文本
const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { sessionId, score, tags = [], comment = '' } = event;
  if (!sessionId) throw new BizError('sessionId 必填');
  if (!score || score < 1 || score > 5) throw new BizError('评分 1-5');
  if (comment && comment.length > 500) throw new BizError('评论最多 500 字');

  const db = cloud.database();
  const session = await db.collection('chatSessions').where({ sessionId }).limit(1).get();
  if (!session.data[0]) throw new BizError('会话不存在');
  const s = session.data[0];

  if (s._openid !== event._openid) throw new BizError('只能评价自己的会话');
  if (s.rated) throw new BizError('已评价过');

  await db.collection('chatSessions').doc(s._id).update({
    data: {
      rated: true,
      rateScore: Number(score),
      rateTags: tags,
      rateComment: comment,
      rateTime: Date.now(),
      updateTime: Date.now()
    }
  });

  // 算客服总评分
  if (s._adminOpenid) {
    const all = await db.collection('chatSessions')
      .where({ _adminOpenid: s._adminOpenid, rated: true })
      .limit(500)
      .get();
    if (all.data.length > 0) {
      const total = all.data.reduce((sum, o) => sum + (o.rateScore || 0), 0);
      const avg = Number((total / all.data.length).toFixed(2));
      const user = await db.collection('users').where({ _openid: s._adminOpenid }).limit(1).get();
      if (user.data[0]) {
        await db.collection('users').doc(user.data[0]._id).update({
          data: { rating: avg, ratingCount: all.data.length }
        });
      }
    }
  }

  return ok();
});
