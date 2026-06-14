// cloudfunctions/registryDevice/index.js
// 设备注册(兼容性 + 能力上报)
//   { deviceInfo: { platform, formFactor, screenWidth, screenHeight,
//                   dpr, ua, osVersion, brand, model, appVersion, isFoldable } }
// 服务端:
//   - 校验
//   - 返回能力子集
//   - 写 devices 集合(便于分析)

const { cloud, ok, fail, logger, authOptional, ErrorCode } = require('../common/index.js');
const {
  normalizeDevice, capabilities, assertValid
} = require('../common/device.js');

exports.main = authOptional(async (event, context) => {
  const db = cloud.database();
  const info = event.deviceInfo;
  if (!info) return fail('deviceInfo 必填', ErrorCode.DEVICE_INFO_INVALID);

  let normalized;
  try {
    normalized = normalizeDevice({ deviceInfo: info });
    assertValid(normalized);
  } catch (e) {
    return fail(e.message, e.code || ErrorCode.DEVICE_INFO_INVALID);
  }
  const caps = capabilities(normalized.platform, normalized.formFactor);

  // 写库
  try {
    const now = Date.now();
    const doc = Object.assign({}, normalized, { capabilities: caps, lastSeen: now });
    if (event.clientId) {
      doc.clientId = event.clientId;
      // upsert
      const ex = await db.collection('devices').where({ clientId: event.clientId }).limit(1).get();
      if (ex.data && ex.data.length) {
        await db.collection('devices').doc(ex.data[0]._id).update({ data: doc });
      } else {
        await db.collection('devices').add({ data: Object.assign({ createdAt: now }, doc) });
      }
    } else {
      await db.collection('devices').add({ data: doc });
    }
  } catch (e) {
    logger.warn('save device fail', { e: e.message });
  }

  logger.info('device registered', {
    platform: normalized.platform, formFactor: normalized.formFactor, breakpoint: normalized.breakpoint
  });
  return ok({ device: normalized, capabilities: caps });
});
