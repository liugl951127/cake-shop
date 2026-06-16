// cloudfunctions/adminChat/index.js
// 客服管理(后台): 会话列表/拉黑/历史/主动发消息/转接
//   action: 'listSessions' | 'history' | 'sendMsg' | 'close' | 'reopen' | 'blockUser' | 'unblockUser' | 'transfer' | 'agents'
const { cloud, ok, logger, auth, requireAdmin, BizError, ErrorCode } = require('../common/index.js');

const VALID_ACTIONS = ['listSessions', 'history', 'sendMsg', 'close', 'reopen',
                       'blockUser', 'unblockUser', 'transfer', 'agents', 'blacklist'];

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { action } = event;
  if (!VALID_ACTIONS.includes(action)) throw new BizError('action 必填', ErrorCode.BAD_REQUEST);
  const db = cloud.database();
  const now = Date.now();

  switch (action) {
    case 'listSessions': {
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 20), 100);
      const where = {};
      if (event.status) where.status = event.status;
      if (event.agentId) where.agentId = event.agentId;
      if (event.openid) where._openid = event.openid;
      if (event.startTime || event.endTime) {
        where.createTime = {};
        if (event.startTime) where.createTime = db.command.gte(Number(event.startTime));
        if (event.endTime) where.createTime = db.command.lte(Number(event.endTime));
      }
      const res = await db.collection('chat_sessions').where(where)
        .orderBy('lastMessageTime', 'desc')
        .skip((page - 1) * size)
        .limit(size)
        .get();
      const cnt = await db.collection('chat_sessions').where(where).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'history': {
      const sessionId = event.sessionId;
      if (!sessionId) throw new BizError('sessionId 必填', ErrorCode.BAD_REQUEST);
      const page = Number(event.page || 1);
      const size = Math.min(Number(event.size || 50), 200);
      const res = await db.collection('chat_messages')
        .where({ sessionId })
        .orderBy('ts', 'asc')
        .skip((page - 1) * size)
        .limit(size)
        .get();
      const cnt = await db.collection('chat_messages').where({ sessionId }).count().catch(() => ({ total: 0 }));
      return ok({ list: res.data || [], total: cnt.total, page, size });
    }

    case 'sendMsg': {
      const { sessionId, type, content, rich, fromType, fromName } = event;
      if (!sessionId) throw new BizError('sessionId 必填', ErrorCode.BAD_REQUEST);
      if (!type) throw new BizError('type 必填', ErrorCode.BAD_REQUEST);
      // 走 wsGateway 内部发送
      const r = await cloud.callFunction({
        name: 'wsGateway',
        data: {
          action: 'adminSend',
          sessionId, type, content, rich,
          fromType: fromType || 'agent',
          fromName: fromName || '客服',
          adminId: event.adminId || event._openid
        }
      });
      return r.result || ok({ sent: true });
    }

    case 'close': {
      const sessionId = event.sessionId;
      if (!sessionId) throw new BizError('sessionId 必填', ErrorCode.BAD_REQUEST);
      await db.collection('chat_sessions').doc(sessionId).update({
        data: {
          status: 'closed',
          closedAt: now,
          closedBy: event.adminId || event._openid,
          closeReason: event.reason || 'admin_close',
          updateTime: now
        }
      });
      await _audit(db, event, 'chat.close', sessionId, { reason: event.reason });
      return ok({ closed: sessionId });
    }

    case 'reopen': {
      const sessionId = event.sessionId;
      if (!sessionId) throw new BizError('sessionId 必填', ErrorCode.BAD_REQUEST);
      await db.collection('chat_sessions').doc(sessionId).update({
        data: {
          status: 'pending',
          reopenedAt: now,
          reopenBy: event.adminId || event._openid,
          updateTime: now
        }
      });
      await _audit(db, event, 'chat.reopen', sessionId, {});
      return ok({ reopened: sessionId });
    }

    case 'blockUser': {
      const { userId, openid, reason, duration } = event;
      const id = userId || openid;
      if (!id) throw new BizError('userId/openid 必填', ErrorCode.BAD_REQUEST);
      const until = duration ? now + Number(duration) * 1000 : 0;
      await db.collection('chat_blacklist').add({
        data: {
          userId: id,
          reason: reason || '',
          until: until,
          createBy: event.adminId || event._openid,
          createTime: now
        }
      });
      await _audit(db, event, 'chat.blockUser', id, { reason, duration });
      return ok({ blocked: id });
    }

    case 'unblockUser': {
      const { userId, openid } = event;
      const id = userId || openid;
      if (!id) throw new BizError('userId/openid 必填', ErrorCode.BAD_REQUEST);
      await db.collection('chat_blacklist').where({ userId: id }).remove().catch(() => {});
      await _audit(db, event, 'chat.unblockUser', id, {});
      return ok({ unblocked: id });
    }

    case 'transfer': {
      const { sessionId, toAgentId, toAgentName, reason } = event;
      if (!sessionId) throw new BizError('sessionId 必填', ErrorCode.BAD_REQUEST);
      if (!toAgentId) throw new BizError('toAgentId 必填', ErrorCode.BAD_REQUEST);
      await db.collection('chat_sessions').doc(sessionId).update({
        data: {
          agentId: toAgentId,
          agentName: toAgentName || '',
          transferAt: now,
          transferReason: reason || '',
          transferBy: event.adminId || event._openid,
          updateTime: now
        }
      });
      await db.collection('chat_transfers').add({
        data: {
          sessionId, toAgentId, toAgentName,
          reason, operator: event.adminId || event._openid,
          ts: now
        }
      });
      await _audit(db, event, 'chat.transfer', sessionId, { toAgentId, reason });
      return ok({ transferred: toAgentId });
    }

    case 'agents': {
      const res = await db.collection('chat_agents')
        .where({ status: 1 })
        .field({ agentId: true, name: true, status: true, currentSessions: true, maxSessions: true })
        .get();
      return ok({ list: res.data || [] });
    }

    case 'blacklist': {
      const res = await db.collection('chat_blacklist')
        .orderBy('createTime', 'desc')
        .limit(100)
        .get();
      return ok({ list: res.data || [] });
    }
  }
});

async function _audit(db, event, action, resourceId, payload) {
  try {
    await db.collection('audit_logs').add({
      data: {
        action, resourceType: 'chat', resourceId,
        payload, adminId: event.adminId || '',
        adminName: event.adminName || '',
        tenantId: event.tenantId || 'default', ts: Date.now()
      }
    });
  } catch (e) {}
}
