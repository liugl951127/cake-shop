// 通用审计日志工具
// 各业务云函数可调 audit.write(event, action, target, detail) 自动留痕
const { cloud } = require('./index.js');

async function write(event, action, targetType, targetId, detail) {
  try {
    await cloud.database().collection('auditLogs').add({
      data: {
        operatorId: event._userId || '',
        operatorName: event._userName || '',
        action,
        targetType,
        targetId: targetId || '',
        detail: typeof detail === 'object' ? JSON.stringify(detail) : String(detail || ''),
        ip: '',
        userAgent: '',
        createTime: Date.now()
      }
    });
  } catch (e) {
    console.error('[audit] write fail:', e.message);
  }
}

module.exports = { write };
