// replyReview - 商家回复评价
const { cloud, ok, fail, auth, BizError } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { reviewId, content = '' } = event;
  if (!reviewId) return fail('reviewId 必填');
  if (!content || content.length > 300) return fail('回复 300 字内');

  const db = cloud.database();
  const review = await db.collection('reviews').doc(reviewId).get();
  if (!review.data) return fail('评价不存在');

  // 必须是商家回复(有店铺权限的)
  // 简化: 当前用户必须有 shopId 且对应 review.shopId
  const me = await db.collection('users').doc(event._userId).get();
  if (!me.data || me.data._id !== review.data.shopId) {
    return fail('无权回复', -403);
  }

  const now = Date.now();
  const reply = {
    _openid: event._openid,
    _userId: event._userId,
    parentId: reviewId,
    goodsId: review.data.goodsId,
    orderId: review.data.orderId,
    shopId: review.data.shopId,
    content: content.trim(),
    score: 5,
    images: [],
    anonymous: false,
    isAppend: false,
    isShopReply: true,
    nickName: me.data.nickName || '商家',
    avatarUrl: me.data.avatarUrl || '',
    likeCount: 0,
    replyCount: 0,
    status: 1,
    createTime: now,
    updateTime: now
  };
  const res = await db.collection('reviews').add({ data: reply });

  // 给评价人发通知
  if (review.data._openid) {
    await db.collection('messages').add({
      data: {
        toOpenid: review.data._openid,
        toUserId: review.data._userId,
        type: 'review_reply',
        title: '商家回复了您的评价',
        content: content.slice(0, 30),
        relatedId: reviewId,
        read: false,
        createTime: now
      }
    }).catch(() => {});
  }

  return ok({ replyId: res._id });
});
