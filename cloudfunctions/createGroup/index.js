// createGroup - 开团
const { cloud, ok, BizError, auth } = require('../common/index.js');

const GROUP_DURATION = 24 * 60 * 60 * 1000; // 24 小时

exports.main = auth(async (event) => {
  const { goodsId, count = 1, groupSize = 3, groupPrice } = event;
  if (!goodsId) throw new BizError('goodsId 必填');
  const db = cloud.database();
  const _ = db.command;

  const activity = await db.collection('groupActivity').where({
    goodsId, status: 1
  }).limit(1).get();
  if (!activity.data[0]) throw new BizError('该商品暂无拼团活动');
  const act = activity.data[0];
  if (act.stock < count) throw new BizError('活动库存不足');

  const groupId = `G${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const expireTime = Date.now() + GROUP_DURATION;
  const finalPrice = groupPrice || act.groupPrice;

  await db.collection('groups').add({
    data: {
      groupId,
      _openid: event._openid,
      _userId: event._userId,
      goodsId,
      goodsName: act.goodsName,
      goodsImage: act.goodsImage,
      price: act.price,
      groupPrice: finalPrice,
      groupSize: Math.max(2, Math.min(5, groupSize || act.groupSize || 3)),
      currentSize: 1,
      members: [{
        _openid: event._openid,
        nickName: act.leaderNickName || '团长',
        avatarUrl: '',
        joinedAt: Date.now(),
        isLeader: true,
        orderId: ''
      }],
      status: 1,  // 1-拼团中 2-已成团 3-已失败 4-已退款
      expireTime,
      createTime: Date.now()
    }
  });

  // 扣活动库存
  await db.collection('groupActivity').doc(act._id).update({
    data: { stock: _.inc(-count), sold: _.inc(count) }
  });

  return ok({ groupId, groupPrice: finalPrice, expireTime });
});
