// sendChatMessage - 发送消息
const { cloud, ok, BizError, auth } = require('../common/index.js');
const { formatTime } = require('../common/formatTime.js');

const TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  ORDER: 'order',   // 订单卡片
  GOODS: 'goods'    // 商品卡片
};

exports.main = auth(async (event) => {
  const { sessionId, type = 'text', content = '', payload = null } = event;
  if (!sessionId) throw new BizError('sessionId 必填');
  if (type === 'text' && !content) throw new BizError('内容不能为空');

  const db = cloud.database();
  const _ = db.command;
  const session = await db.collection('chatSessions').where({ sessionId }).limit(1).get();
  if (!session.data[0]) throw new BizError('会话不存在');
  const s = session.data[0];

  // 校验权限
  if (s._openid !== event._openid && !event._isAdmin) {
    throw new BizError('无权操作此会话');
  }
  if (s.status === 3) throw new BizError('会话已结束');

  const fromType = event._isAdmin ? 'admin' : 'user';
  const messageId = `M${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const now = Date.now();

  // 写消息
  const msgRes = await db.collection('chatMessages').add({
    data: {
      messageId,
      sessionId,
      _openid: s._openid,
      fromType,
      _fromOpenid: fromType === 'admin' ? event._openid : s._openid,
      fromName: event._isAdmin ? (event._adminName || '客服') : '',
      type,
      content,
      payload,
      status: 1, // 1-已发 2-已读
      createTime: now
    }
  });

  // 更新会话最后消息
  const updateData = {
    lastMessage: type === 'text' ? content : `[${type === 'image' ? '图片' : '卡片'}]`,
    lastMessageTime: now,
    updateTime: now
  };
  if (fromType === 'user') updateData.unreadByAdmin = _.inc(1);
  else updateData.unreadByUser = _.inc(1);

  await db.collection('chatSessions').doc(s._id).update({ data: updateData });

  return ok({
    _id: msgRes._id,
    messageId,
    createTime: now,
    timeText: formatTime(new Date(now), 'HH:mm')
  });
});
