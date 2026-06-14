// joinGroup - 加入团
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = auth(async (event) => {
  const { groupId, orderId } = event;
  if (!groupId) throw new BizError('groupId 必填');
  if (!orderId) throw new BizError('orderId 必填');

  const db = cloud.database();
  const _ = db.command;

  const group = await db.collection('groups').where({ groupId }).limit(1).get();
  if (!group.data[0]) throw new BizError('团不存在');
  const g = group.data[0];
  if (g.status !== 1) throw new BizError('该团已结束');
  if (g.expireTime < Date.now()) throw new BizError('该团已过期');
  if (g.members.some(m => m._openid === event._openid)) throw new BizError('已在团中');
  if (g.currentSize >= g.groupSize) throw new BizError('团已满');

  // 成员加入
  const newMembers = [...g.members, {
    _openid: event._openid,
    _userId: event._userId,
    nickName: '',
    avatarUrl: '',
    joinedAt: Date.now(),
    isLeader: false,
    orderId
  }];

  const newSize = g.currentSize + 1;
  const isComplete = newSize >= g.groupSize;
  const newStatus = isComplete ? 2 : 1;

  await db.collection('groups').doc(g._id).update({
    data: { members: newMembers, currentSize: newSize, status: newStatus, updateTime: Date.now() }
  });

  // 关联订单为拼团订单
  await db.collection('orders').doc(orderId).update({
    data: {
      groupId,
      isGroupOrder: true,
      groupPrice: g.groupPrice,
      updateTime: Date.now()
    }
  });

  if (isComplete) {
    // 成团:把团内所有订单状态切到正常
    for (const m of newMembers) {
      if (m.orderId) {
        await db.collection('orders').doc(m.orderId).update({
          data: { groupStatus: 'success', updateTime: Date.now() }
        });
      }
    }
  }

  return ok({ groupId, groupStatus: isComplete ? 2 : 1, currentSize: newSize });
});
