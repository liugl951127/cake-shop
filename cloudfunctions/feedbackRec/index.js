// feedbackRec - 推荐反馈(点击 / 加购 / 收藏 / 购买)
const { cloud, ok, auth } = require('../common/index.js');

const ACTION_WEIGHT = {
  view: 1,        // 曝光
  click: 5,       // 点击
  cart: 15,       // 加购
  favorite: 10,   // 收藏
  purchase: 50,   // 购买
  unlike: -20     // 不喜欢
};

exports.main = auth(async (event) => {
  const { goodsId, action = 'click', scene = '' } = event;
  if (!goodsId) return ok({});
  if (ACTION_WEIGHT[action] === undefined) return ok({});

  const db = cloud.database();
  const now = Date.now();

  // 写反馈记录
  await db.collection('recFeedbacks').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      goodsId,
      action,
      weight: ACTION_WEIGHT[action],
      scene,
      createTime: now
    }
  }).catch(() => {});

  // 更新用户-商品偏好分数(增量)
  const key = `pref.${goodsId}`;
  await db.collection('userPrefs').where({ _userId: event._userId, goodsId }).update({
    data: { score: db.command.inc(ACTION_WEIGHT[action]), updateTime: now }
  }).catch(async () => {
    await db.collection('userPrefs').add({
      data: {
        _userId: event._userId, _openid: event._openid,
        goodsId, score: ACTION_WEIGHT[action],
        createTime: now, updateTime: now
      }
    }).catch(() => {});
  });

  return ok({ weight: ACTION_WEIGHT[action] });
});
