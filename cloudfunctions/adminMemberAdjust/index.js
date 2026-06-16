// cloudfunctions/adminMemberAdjust/index.js
// 会员调整: 积分/等级/余额/状态
//   action: 'addPoints' | 'subPoints' | 'setLevel' | 'freeze' | 'unfreeze' | 'setBalance'
//   都写 audit_logs
const { cloud, ok, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

const VALID_ACTIONS = ['addPoints', 'subPoints', 'setLevel', 'freeze', 'unfreeze', 'setBalance'];

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { action, userId, payload, reason } = event;
  if (!VALID_ACTIONS.includes(action)) {
    throw new BizError('不支持的 action: ' + action, ErrorCode.BAD_REQUEST);
  }
  if (!userId) throw new BizError('userId 必填', ErrorCode.BAD_REQUEST);
  if (!payload) throw new BizError('payload 必填', ErrorCode.BAD_REQUEST);

  const db = cloud.database();
  const _ = db.command;
  const now = Date.now();
  const update = { updateTime: now };

  switch (action) {
    case 'addPoints':
    case 'subPoints': {
      const delta = Number(payload.points);
      if (!delta || isNaN(delta)) throw new BizError('payload.points 必填(数字)', ErrorCode.BAD_REQUEST);
      const realDelta = action === 'subPoints' ? -Math.abs(delta) : Math.abs(delta);
      update.points = _.inc(realDelta);
      // 写积分流水
      await db.collection('points_logs').add({
        data: {
          userId, change: realDelta,
          action: action === 'addPoints' ? 'admin_add' : 'admin_sub',
          reason: reason || '管理员调整',
          operator: event.adminId || event._openid,
          operatorType: 'admin',
          ts: now,
          tenantId: event.tenantId || 'default'
        }
      });
      break;
    }
    case 'setLevel':
      if (payload.level == null) throw new BizError('payload.level 必填', ErrorCode.BAD_REQUEST);
      update.level = Number(payload.level);
      update.levelUpdateTime = now;
      break;
    case 'freeze':
      update.status = -1;
      update.freezeTime = now;
      update.freezeReason = reason || '';
      break;
    case 'unfreeze':
      update.status = 1;
      update.unfreezeTime = now;
      break;
    case 'setBalance':
      const bal = Number(payload.balance);
      if (isNaN(bal) || bal < 0) throw new BizError('payload.balance 必填(>=0)', ErrorCode.BAD_REQUEST);
      update.balance = bal;
      // 写余额流水
      await db.collection('balance_logs').add({
        data: {
          userId, change: bal, balance: bal,
          action: 'admin_set',
          reason: reason || '管理员调整',
          operator: event.adminId || event._openid,
          operatorType: 'admin',
          ts: now,
          tenantId: event.tenantId || 'default'
        }
      });
      break;
  }

  // 找/创建用户
  let user = await db.collection('members').where({ userId }).limit(1).get()
    .then(r => r.data && r.data[0])
    .catch(() => null);
  if (!user) {
    // 创建
    await db.collection('members').add({
      data: Object.assign({
        userId, createTime: now,
        points: 0, balance: 0, level: 0, status: 1
      }, update)
    });
  } else {
    await db.collection('members').doc(user._id).update({ data: update });
  }

  // 审计
  await _audit(db, event, 'member.' + action, userId, { payload, reason });
  logger.info('admin member adjust', { userId, action, adminId: event.adminId });
  return ok({ userId, action });
});

async function _audit(db, event, action, userId, payload) {
  try {
    await db.collection('audit_logs').add({
      data: {
        action, resourceType: 'member', resourceId: userId,
        payload: payload || {},
        adminId: event.adminId || '',
        adminName: event.adminName || '',
        tenantId: event.tenantId || 'default',
        ts: Date.now()
      }
    });
  } catch (e) {}
}
