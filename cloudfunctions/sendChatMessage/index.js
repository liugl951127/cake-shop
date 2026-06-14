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
  // text/order/goods 需要 content;image/file 走云存储 fileID
  if (type === 'text' && !content) throw new BizError('内容不能为空');
  if (['image', 'file'].includes(type) && !content) throw new BizError('文件 ID 必填');

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

  // 图片/文件:校验是否在白名单路径下,防跨账户读取
  if (['image', 'file'].includes(type)) {
    if (!content.startsWith('cloud://')) throw new BizError('fileID 无效');
  }

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
      status: 1,
      createTime: now
    }
  });

  // 更新会话最后消息
  const lastTextMap = { text: content, image: '[图片]', file: '[文件]', order: '[订单]', goods: '[商品]' };
  const updateData = {
    lastMessage: lastTextMap[type] || '[消息]',
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
