// cancelOrder - 取消订单(带状态机校验 + 库存恢复)
//
// 状态机: 0(待付款) → -1(已取消) / 4(已完成) → -1
// 权限:   订单所有者 或 管理员
// 副作用: 恢复库存(回滚 sales 计数)
const {
  cloud, ok, logger, auth, BizError, ErrorCode
} = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');
const { findOneOrThrow } = require('../common/transaction.js');

const ALLOW_CANCEL_STATUS = [0];  // 只有待付款可主动取消(其他走退款流程)

exports.main = auth(async (event) => {
  const { id, remove = false, reason = '用户主动取消' } = event;
  if (!id) throw new BizError('id 必填', ErrorCode.BAD_REQUEST);

  const db = cloud.database();
  const _ = db.command;

  // 1. 查询订单(强校验)
  const o = await findOneOrThrow(db, 'orders', { _id: id }, '订单不存在');

  // 2. 权限: 仅订单所有者或管理员
  if (o._openid !== event._openid && !event._isAdmin) {
    logger.warn('cancelOrder forbidden', {
      orderId: id,
      requestOpenid: event._openid,
      orderOpenid: o._openid
    });
    throw new BizError('无权操作', ErrorCode.FORBIDDEN);
  }

  // 3. 物理删除(隐藏)
  if (remove) {
    await db.collection('orders').doc(id).remove();
    logger.info('order removed', { orderId: id, by: event._openid });
    return ok({ removed: true });
  }

  // 4. 状态机校验
  if (!ALLOW_CANCEL_STATUS.includes(o.status)) {
    throw new BizError(
      `订单当前状态(${o.status})不可取消,已支付请走退款流程`,
      ErrorCode.ORDER_STATUS_INVALID
    );
  }

  // 5. 恢复库存
  const rollbackTasks = (o.items || []).map((it) =>
    db.collection('goods').doc(it._id).update({
      data: { stock: _.inc(it.count || 0), sales: _.inc(-(it.count || 0)) }
    }).catch((e) => logger.warn('库存回滚失败', { goodsId: it._id, err: e.message }))
  );
  await Promise.all(rollbackTasks);

  // 6. 更新订单状态
  await db.collection('orders').doc(id).update({
    data: { status: -1, cancelReason: reason, updateTime: Date.now() }
  });

  // 7. 写订单日志
  await writeLog(db, {
    orderId: id, orderNo: o.orderNo, _openid: o._openid,
    action: 'cancel', fromStatus: 0, toStatus: -1,
    operator: event._openid, operatorType: 'user',
    remark: reason
  });

  logger.info('order cancelled', { orderId: id, reason });
  return ok({ cancelled: true });
});
