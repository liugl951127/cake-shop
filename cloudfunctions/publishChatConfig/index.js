// cloudfunctions/publishChatConfig/index.js
// 接收 Spring Boot 后台推送的聊天配置,写入云开发数据库
// 之后 sendChatMessage / wsGateway 可实时读取

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');

const COLLECTION = 'chat_configs';

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  // 必须由后台调用(带 internal token)
  if (event.internalToken !== 'BACKEND_PUSH_2024') {
    return fail('权限不足', ErrorCode.PERMISSION_DENIED);
  }

  const config = event.config || {
    welcome: event.welcome,
    quickReplies: event.quickReplies,
    autoReplies: event.autoReplies,
    transferRules: event.transferRules,
    blacklist: event.blacklist
  };
  if (!config) {
    return fail('config 必填', ErrorCode.BAD_REQUEST);
  }

  // 写为单条记录(覆盖式)
  const _ = db.command;
  const existing = await db.collection(COLLECTION).limit(1).get();
  const now = Date.now();
  const doc = {
    ...config,
    updatedAt: now,
    version: (existing.data[0] && existing.data[0].version || 0) + 1
  };
  if (existing.data.length) {
    await db.collection(COLLECTION).doc(existing.data[0]._id).update({ data: doc });
  } else {
    await db.collection(COLLECTION).add({ data: { ...doc, createdAt: now } });
  }
  logger.info('chat config published', { version: doc.version });
  return ok({ version: doc.version, updatedAt: now });
});
