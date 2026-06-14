// getChatDashboard - 客服数据看板
const { cloud, ok, auth, requireAdmin } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { adminOpenid = '', days = 7 } = event;
  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const since = now - days * 86400000;

  // 客服列表
  const admins = await db.collection('users').where({ isAdmin: true }).get();

  // 客服数据聚合
  const where = adminOpenid ? { _adminOpenid: adminOpenid } : {};
  const sessions = await db.collection('chatSessions')
    .where({ ...where, createTime: _.gte(since) })
    .limit(1000)
    .get();

  const closed = sessions.data.filter(s => s.status === 3);
  const rated = closed.filter(s => s.rated);

  // 响应时长:用户发第一条消息到客服第一条回复
  const responseTimes = [];
  for (const s of closed) {
    const msgs = await db.collection('chatMessages')
      .where({ sessionId: s.sessionId, fromType: 'user' })
      .orderBy('createTime', 'asc')
      .limit(1)
      .get();
    if (!msgs.data[0]) continue;
    const userFirst = msgs.data[0].createTime;
    const reply = await db.collection('chatMessages')
      .where({ sessionId: s.sessionId, fromType: 'admin', createTime: _.gt(userFirst) })
      .orderBy('createTime', 'asc')
      .limit(1)
      .get();
    if (reply.data[0]) {
      responseTimes.push(reply.data[0].createTime - userFirst);
    }
  }

  responseTimes.sort((a, b) => a - b);
  const avgResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  const medianResponseMs = responseTimes.length > 0
    ? responseTimes[Math.floor(responseTimes.length / 2)]
    : 0;

  // 评分分布
  const scoreDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of rated) {
    const k = Math.round(s.rateScore);
    if (scoreDist[k] !== undefined) scoreDist[k]++;
  }
  const avgScore = rated.length > 0
    ? Number((rated.reduce((s, o) => s + (o.rateScore || 0), 0) / rated.length).toFixed(2))
    : 0;

  // 高频关键词(tag)
  const tagCnt = {};
  for (const s of rated) {
    for (const t of (s.rateTags || [])) {
      tagCnt[t] = (tagCnt[t] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCnt).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // 每日会话量趋势
  const dailyTrend = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = now - (i + 1) * 86400000;
    const next = d + 86400000;
    const cnt = sessions.data.filter(s => s.createTime >= d && s.createTime < next).length;
    dailyTrend.push({
      date: new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      count: cnt
    });
  }

  // 各客服工作量
  const workload = admins.data.map(a => {
    const list = sessions.data.filter(s => s._adminOpenid === a._openid);
    return {
      _id: a._id,
      openid: a._openid,
      nickName: a.nickName,
      avatarUrl: a.avatarUrl,
      isOnline: a.isOnline,
      sessionCount: list.length,
      closedCount: list.filter(s => s.status === 3).length,
      rating: a.rating || 0,
      ratingCount: a.ratingCount || 0
    };
  }).sort((a, b) => b.sessionCount - a.sessionCount);

  return ok({
    overview: {
      totalSessions: sessions.data.length,
      closedSessions: closed.length,
      ratedSessions: rated.length,
      rateRate: closed.length > 0 ? (rated.length / closed.length * 100).toFixed(1) : 0,
      avgScore,
      avgResponseMs,
      medianResponseMs,
      responseCount: responseTimes.length
    },
    scoreDist,
    topTags,
    dailyTrend,
    workload,
    admins: admins.data.map(a => ({ _id: a._id, nickName: a.nickName, avatarUrl: a.avatarUrl, rating: a.rating || 0 }))
  });
});
