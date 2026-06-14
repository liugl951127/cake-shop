// cloudfunctions/wecomSendText/index.js
// 客服主动给客户发消息(支持 text/image/rich)
//   - 鉴权: agent 角色 (adminBypass 后台)
//   - 限流: 1 session 5 msg/s
//   - 同步: 落 chat_messages(便于前端拉取,离线操作可重放)
//   - 校验: session 状态不能是 closed/archived

const { cloud, ok, fail, logger, authOptional, ErrorCode, BizError } = require('../common/index.js');
const wecom = require('../common/wecom.js');
const { Status, checkReplyRate } = require('../common/session.js');
const { MessageType, MessageTypeSet } = require('../common/messageTypes.js');
const { saveChatMessage } = require('../common/storage.js');

const crypto = require('crypto');
const MASTER_KEY = process.env.WECOM_MASTER_KEY || 'cake-shop-wecom-2024-32bytes!!';

function decryptSecret(enc) {
  if (!enc) return '';
  try {
    const [iv, tag, data] = enc.split(':');
    const key = Buffer.from(MASTER_KEY);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    let s = decipher.update(Buffer.from(data, 'base64'));
    s = Buffer.concat([s, decipher.final()]);
    return s.toString('utf8');
  } catch (e) { return ''; }
}

async function loadConfig(db) {
  const r = await db.collection('wecom_config').limit(1).get();
  if (!r.data || r.data.length === 0) return null;
  const c = r.data[0];
  return {
    corpId: c.corpId,
    corpSecret: decryptSecret(c.corpSecretEnc || '')
  };
}

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const { sessionId, type, content, rich, extra, openKfId, externalUserId, agentId } = event;
  if (!sessionId) return fail('sessionId 必填', ErrorCode.BAD_REQUEST);
  if (!openKfId || !externalUserId) return fail('openKfId/externalUserId 必填', ErrorCode.BAD_REQUEST);
  if (!type || !MessageTypeSet.has(type)) return fail('type 非法', ErrorCode.WECOM_MSG_TYPE_INVALID);

  // 限流
  if (!checkReplyRate(sessionId)) {
    return fail('回复过于频繁(1s 上限 5 条)', ErrorCode.WECOM_REPLY_RATE_LIMIT);
  }

  // 校验会话
  const sessRes = await db.collection('chat_sessions').doc(sessionId).get();
  if (!sessRes.data) return fail('会话不存在', ErrorCode.CHAT_SESSION_NOT_FOUND);
  const sess = sessRes.data;
  if (sess.status === Status.CLOSED || sess.status === Status.ARCHIVED) {
    return fail('会话已关闭', ErrorCode.SESSION_ALREADY_CLOSED);
  }

  // 拿企微配置
  const cfg = await loadConfig(db);
  if (!cfg) return fail('企业微信未配置', ErrorCode.WECOM_CONFIG_MISSING);
  wecom.setConfig({ corpId: cfg.corpId, corpSecret: cfg.corpSecret });

  // 构造企微消息体
  let wecomMsgType, wecomBody;
  if (type === 'text') {
    wecomMsgType = 'text';
    wecomBody = { content: (content || '').slice(0, 5000) };
  } else if (type === 'image') {
    wecomMsgType = 'image';
    wecomBody = { media_id: (extra && extra.mediaId) || (extra && extra.fileId) };
    if (!wecomBody.media_id) return fail('image 消息需 extra.mediaId', ErrorCode.CHAT_MESSAGE_INVALID);
  } else if (type === 'rich') {
    // 富文本:拆成多消息 或 转 markdown
    wecomMsgType = 'text';
    wecomBody = { content: richToMarkdown(rich) };
  } else if (type === 'file') {
    wecomMsgType = 'file';
    wecomBody = { media_id: (extra && extra.mediaId) || (extra && extra.fileId) };
    if (!wecomBody.media_id) return fail('file 消息需 extra.mediaId', ErrorCode.CHAT_MESSAGE_INVALID);
  } else {
    return fail('不支持的消息类型', ErrorCode.WECOM_MSG_TYPE_INVALID);
  }

  // 调企微发消息
  let sendRes;
  try {
    sendRes = await wecom.sendKfMessage(openKfId, externalUserId, wecomMsgType, wecomBody);
  } catch (e) {
    if (e.code) return fail(e.message, e.code);
    return fail(e.message, ErrorCode.WECOM_MSG_SEND_FAIL);
  }

  // 落 chat_messages
  const now = Date.now();
  const msg = await saveChatMessage(db, {
    sessionId,
    type: wecomMsgType === 'image' ? 'image' : (type === 'rich' ? 'rich' : wecomMsgType),
    from: openKfId,
    fromName: '客服',
    fromRole: 'agent',
    to: externalUserId,
    content: wecomMsgType === 'text' ? wecomBody.content : '[富文本]',
    rich: type === 'rich' ? rich : null,
    extra: Object.assign({ wcomMsgId: sendRes.msgid, agentId }, extra || {}),
    ts: now
  });

  // 触发表
  try {
    await db.collection('chat_sessions').doc(sessionId).update({
      data: {
        lastMessage: wecomMsgType === 'text' ? wecomBody.content : '[' + wecomMsgType + ']',
        lastTs: now,
        updatedAt: now,
        'unread.user': db.command.inc(1)
      }
    });
  } catch (e) {}

  logger.info('wecom send ok', { sessionId, type, msgid: sendRes.msgid });
  return ok({
    msgId: msg._id,
    serverMsgId: sendRes.msgid,
    ts: now
  });
});

function richToMarkdown(nodes) {
  if (!Array.isArray(nodes)) return '';
  return nodes.map(n => {
    if (n.t === 'br') return '\n';
    if (n.t === 'img') return `[图片](${n.v})`;
    if (n.t === 'a') return `[${n.v}](${n.a && n.a.href || '#'})`;
    if (n.t === 'b') return `**${n.v}**`;
    if (n.t === 'i') return `*${n.v}*`;
    if (n.t === 's') return `~~${n.v}~~`;
    if (n.t === 'code') return `\`${n.v}\``;
    if (n.t === 'emoji') return n.v;
    return n.v || '';
  }).join('');
}
