// addReview - 发表评价(支持文字/图片/星级)
// 限制: 同一订单同一商品只能评一次,可 30 天内追评
const { cloud, ok, fail, auth, BizError } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { orderId, goodsId, score, content = '', images = [], anonymous = false, parentId = '' } = event;
  if (!orderId || !goodsId) return fail('orderId + goodsId 必填');
  if (!score || score < 1 || score > 5) return fail('评分 1-5');
  if (content && content.length > 500) return fail('评价 500 字内');
  if (images && images.length > 9) return fail('图片最多 9 张');

  const db = cloud.database();
  const _ = db.command;

  // 验证订单
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) return fail('订单不存在', -404);
  if (order.data._userId !== event._userId) return fail('无权评价', -403);
  if (order.data.status < 3) return fail('订单未完成,不能评价');

  // 检查是否已评
  const exists = await db.collection('reviews')
    .where({ orderId, goodsId, _userId: event._userId, parentId: parentId || '' })
    .count();
  if (exists.total > 0) return fail('已评价过');

  // 订单里有没有这个商品
  const item = (order.data.goods || []).find(g => g.goodsId === goodsId);
  if (!item) return fail('订单不含此商品');

  // 评价时间
  const isAppend = !!parentId;
  let orderFinishTime = order.data.receiveTime || order.data.completeTime || 0;
  if (isAppend && Date.now() - orderFinishTime > 30 * 86400000) {
    return fail('只能在收货后 30 天内追评');
  }

  // 用户信息
  const me = await db.collection('users').doc(event._userId).get().catch(() => null);
  const userInfo = me && me.data ? { nickName: me.data.nickName, avatarUrl: me.data.avatarUrl } : {};

  // 写入
  const now = Date.now();
  const review = {
    _openid: event._openid,
    _userId: event._userId,
    orderId, goodsId,
    shopId: item.shopId || order.data.shopId || '',
    score: Number(score),
    content: content.trim(),
    images: images || [],
    anonymous: !!anonymous,
    parentId: parentId || '',
    isAppend,
    nickName: anonymous ? '匿名用户' : userInfo.nickName || '用户',
    avatarUrl: anonymous ? '' : userInfo.avatarUrl || '',
    likeCount: 0,
    replyCount: 0,
    status: 1,  // 1-正常 0-隐藏 -1-删除
    createTime: now,
    updateTime: now
  };

  const res = await db.collection('reviews').add({ data: review });

  // 商家回复
  if (!isAppend && item.shopId) {
    // 给商家推送"待回复"消息
    await db.collection('messages').add({
      data: {
        toOpenid: '',
        toUserId: '',
        targetUserId: item.shopId,
        type: 'review_new',
        title: '新评价',
        content: `${review.nickName} 给了 ${score} 星`,
        relatedId: res._id,
        read: false,
        createTime: now
      }
    }).catch(() => {});
  }

  // 加积分
  if (me && me.data && !isAppend) {
    const pts = 5;  // 首次评价 +5
    await db.collection('users').doc(event._userId).update({
      data: { points: _.inc(pts) }
    });
    await db.collection('pointLogs').add({
      data: {
        _openid: event._openid, _userId: event._userId,
        type: 'review', delta: pts,
        remark: '评价奖励 5 积分', orderId, createTime: now
      }
    }).catch(() => {});
  }

  return ok({ reviewId: res._id, points: isAppend ? 0 : 5 });
});
