// warmup - 云函数预热入口
// 调用场景:
//   1. 部署后,定时触发器每 5 分钟调一次(防止冷启动)
//   2. 关键业务前手动调用,提前热实例
// 作用: 把 common/SDK 提前 init 一次
const { cloud, logger, config } = require('../common/index.js');

exports.main = async () => {
  const t0 = Date.now();
  try {
    // 触发公共模块初始化
    const db = cloud.database();
    await db.collection('users').limit(1).get();  // 触发连接
    logger.info('warmup ok', {
      duration: Date.now() - t0,
      env: config.ENV
    });
    return { ok: true, duration: Date.now() - t0 };
  } catch (e) {
    logger.error('warmup fail', e);
    return { ok: false, error: e.message };
  }
};
