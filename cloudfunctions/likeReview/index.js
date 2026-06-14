// likeReview - 评价点赞/取消
const { cloud, ok, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { reviewId, action = 'like' } = event;
  if (!reviewId) return ok({});
  const db = cloud.database();
  const _ = db.command;
  const delta = action === 'like' ? 1 : -1;
  await db.collection('reviews').doc(reviewId).update({
    data: { likeCount: _.inc(delta) }
  });
  return ok({ liked: action === 'like' });
});
