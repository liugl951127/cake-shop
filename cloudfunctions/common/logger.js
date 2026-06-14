// common/logger.js - 统一日志
// 用法:
//   const { logger } = require('../common/logger.js');
//   logger.info('用户登录', { userId, ip });
//   logger.error('订单创建失败', err);

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

function fmt(level, msg, meta) {
  const now = new Date().toISOString();
  const base = `[${now}] [${level}] [${msg}]`;
  if (!meta) return base;
  try {
    return `${base} ${JSON.stringify(meta, (k, v) => {
      if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
      return v;
    })}`;
  } catch (e) {
    return `${base} [meta stringify failed: ${e.message}]`;
  }
}

function createLogger(context = {}) {
  const minLevel = LEVEL_NAMES.indexOf(process.env.LOG_LEVEL || 'INFO');

  function log(level, msg, meta) {
    if (LEVELS[level] < minLevel) return;
    const line = fmt(level, msg, { ...context, ...(meta || {}) });
    if (LEVELS[level] >= LEVELS.ERROR) console.error(line);
    else console.log(line);
  }

  return {
    debug: (msg, meta) => log('DEBUG', msg, meta),
    info: (msg, meta) => log('INFO', msg, meta),
    warn: (msg, meta) => log('WARN', msg, meta),
    error: (msg, err, meta) => {
      const errInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      log('ERROR', msg, { ...(meta || {}), error: errInfo });
    },
    fatal: (msg, err, meta) => {
      const errInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      log('FATAL', msg, { ...(meta || {}), error: errInfo });
    },
    child: (extra) => createLogger({ ...context, ...extra })
  };
}

// 默认 logger
const logger = createLogger();

module.exports = { logger, createLogger };
