// cloudfunctions/wecomCallback/index.js
// 企业微信回调 - 接收客服消息 / 事件
//   文档: https://developer.work.weixin.qq.com/document/path/94677
//
// 流程:
//   1. GET 验证: 接收 msg_signature/timestamp/nonce/echostr -> 解密 echostr -> 返回明文
//   2. POST 接收: 解密 -> 解析事件 -> 落到 chat_messages / behavior_logs / 触发后续
//
// 事件类型:
//   - event: kf_msg_or_event(客服消息)
//
// 入参: { msg_signature, timestamp, nonce, echostr? }  GET
//      { msg_signature, timestamp, nonce, encrypt }      POST
// 出参: 字符串(明文) 或 JSON

const { ok, logger, ErrorCode, BizError } = require('../common/index.js');
const { cloud } = require('../common/index.js');
const wecom = require('../common/wecom.js');

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

async function loadConfig() {
  const db = cloud.database();
  const r = await db.collection('wecom_config').limit(1).get();
  if (!r.data || r.data.length === 0) return null;
  const c = r.data[0];
  return {
    corpId: c.corpId,
    token: decryptSecret(c.tokenSecretEnc || ''),
    aesKey: decryptSecret(c.aesKeyEnc || '')
  };
}

exports.main = async (event, context) => {
  // 云函数 HTTP 触发 -> event 含 queryStringParameters
  // 这里兼容多种来源
  const query = event.queryStringParameters || {};
  const body = event.body || event;
  const msgSignature = query.msg_signature || body.msg_signature;
  const timestamp = query.timestamp || body.timestamp;
  const nonce = query.nonce || body.nonce;
  const echostr = query.echostr || body.echostr;
  const encrypt = body.encrypt;

  const cfg = await loadConfig();
  if (!cfg || !cfg.token || !cfg.aesKey) {
    throw new BizError(ErrorCode.WECOM_CONFIG_MISSING, '企业微信未配置');
  }

  // 1. 验签
  if (!wecom.checkSignature(cfg.token, timestamp, nonce, msgSignature, encrypt || echostr)) {
    throw new BizError(ErrorCode.WECOM_SIGN_INVALID, '签名校验失败');
  }

  // 2. GET 验证
  if (echostr) {
    const { msg } = wecom.decryptMessage(echostr, cfg.aesKey);
    logger.info('wecom callback verified', { corpId: msg });
    return msg;  // 字符串返回
  }

  // 3. POST 接收 - 解密
  if (!encrypt) {
    throw new BizError(ErrorCode.WECOM_CALLBACK_INVALID, '缺少 encrypt');
  }
  const { msg: decrypted } = wecom.decryptMessage(encrypt, cfg.aesKey);
  const evt = JSON.parse(decrypted);
  logger.info('wecom callback event', { event: evt.Event || evt.MsgType });

  // 4. 分发
  await handleEvent(evt);

  // 5. 返回 success(企业微信会重试 3 次)
  return 'success';
};

async function handleEvent(evt) {
  const db = cloud.database();
  const now = Date.now();

  // 客服消息事件
  if (evt.Event === 'kf_msg_or_event' || evt.Event === 'kf_msg') {
    // 写到 chat_messages
    // 客服发的消息(open_kfid + external_userid)
    const m = {
      sessionId: evt.OpenKfId && evt.ExternalUserId
        ? `wecom_${evt.OpenKfId}_${evt.ExternalUserId}`
        : 'wecom_unknown',
      type: mapMsgType(evt.MsgType),
      from: evt.OpenKfId,             // 客服
      fromName: '客服',
      fromRole: 'agent',
      to: evt.ExternalUserId,        // 客户
      content: extractText(evt),
      extra: evt,
      offline: false,
      fromWecom: true,
      ts: evt.CreateTime ? evt.CreateTime * 1000 : now,
      created: now
    };
    try {
      await db.collection('chat_messages').add({ data: m });
    } catch (e) {
      logger.warn('wecom save chat fail', { e: e.message });
    }
  }
  // 会话状态变更: 客服接起 / 关闭 / 转接
  else if (evt.Event === 'kf_session_change' || evt.Event === 'kf_session') {
    const { Status, HangupBy } = require('../common/session.js');
    const sessionId = evt.OpenKfId && evt.ExternalUserId
      ? `wecom_${evt.OpenKfId}_${evt.ExternalUserId}`
      : null;
    if (!sessionId) return;
    // evt.ChangeType:
    //   servicer_change / servicer_close / client_close / transfer
    const changeType = evt.ChangeType || '';
    if (changeType === 'servicer_close' || changeType === 'client_close') {
      // 客服/客户在企微端关闭
      const status = 'closed';
      const closedBy = changeType === 'client_close' ? HangupBy.CLIENT : HangupBy.AGENT;
      try {
        const sess = await db.collection('chat_sessions').where({ wecomSessionId: sessionId }).limit(1).get();
        if (sess.data && sess.data.length) {
          await db.collection('chat_sessions').doc(sess.data[0]._id).update({
            data: {
              status, closedAt: now, closedBy,
              updatedAt: now
            }
          });
          // 系统消息
          await db.collection('chat_messages').add({
            data: {
              sessionId: sess.data[0]._id,
              type: 'system', from: 'system', fromRole: 'system',
              content: changeType === 'client_close' ? '客户已结束咨询' : '客服已结束服务',
              ts: now, created: now
            }
          });
        }
      } catch (e) {
        logger.warn('close session fail', { e: e.message });
      }
    } else if (changeType === 'servicer_change' || changeType === 'transfer') {
      // 转接
      try {
        const sess = await db.collection('chat_sessions').where({ wecomSessionId: sessionId }).limit(1).get();
        if (sess.data && sess.data.length) {
          await db.collection('chat_sessions').doc(sess.data[0]._id).update({
            data: {
              servicerUserId: evt.NewServicerUserId || '',
              transferredToWeCom: true,
              transferredAt: now,
              updatedAt: now
            }
          });
        }
      } catch (e) {}
    }
  }
  // 其他事件暂只记录
  try {
    await db.collection('wecom_events').add({
      data: { event: evt.Event || evt.MsgType, payload: evt, ts: now }
    });
  } catch (e) { /* ignore */ }
}

function mapMsgType(wecomType) {
  const map = {
    text: 'text',
    image: 'image',
    voice: 'voice',
    video: 'video',
    file: 'file',
    link: 'rich',
    location: 'rich',
    business_card: 'rich',
    miniprogram: 'rich',
    channel: 'rich',
    event: 'system'
  };
  return map[wecomType] || 'rich';
}

function extractText(evt) {
  if (evt.Text && evt.Text.content) return evt.Text.content;
  if (evt.Image && evt.Image.media_id) return '[图片]';
  if (evt.Voice) return '[语音]';
  if (evt.Video) return '[视频]';
  if (evt.File) return '[文件]';
  if (evt.Link && evt.Link.title) return evt.Link.title;
  if (evt.Location) return '[位置]';
  return '[' + (evt.MsgType || evt.Event) + ']';
}
