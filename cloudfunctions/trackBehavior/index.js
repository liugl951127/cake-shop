// trackBehavior - 行为埋点
const { cloud, ok, auth } = require('../common/index.js');

// 行为类型:view-浏览 favorite-收藏 cart-加购 order-下单 search-搜索
const VALID = ['view', 'favorite', 'cart', 'order', 'search', 'share'];

exports.main = auth(async (event) => {
  const { action, goodsId, keyword, payload = {} } = event;
  if (!action || !VALID.includes(action)) return ok();
  const db = cloud.database();

  // 浏览/搜索可不上报 goodsId
  if (!goodsId && !keyword) return ok();

  await db.collection('behaviors').add({
    data: {
      _openid: event._openid,
      _userId: event._userId,
      action,
      goodsId: goodsId || '',
      keyword: keyword || '',
      payload,
      createTime: Date.now()
    }
  }).catch(() => {});

  return ok();
});
