// adminShipOrder - 管理员发货(填配送信息 + 状态变更为配送中)
const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');
const { writeLog } = require('../common/orderLog.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { id, name, phone, company = '', deliveryNo = '' } = event;
  if (!id) throw new BizError('id 必填');
  if (!name || !phone) throw new BizError('请填写配送员信息');

  const db = cloud.database();
  const order = await db.collection('orders').doc(id).get();
  if (!order.data) throw new BizError('订单不存在');
  const o = order.data;
  if (o.status !== 2) throw new BizError('订单不在制作中,无法发货');

  await db.collection('orders').doc(id).update({
    data: {
      status: 3,
      shipTime: Date.now(),
      deliveryInfo: { name, phone, company, deliveryNo },
      updateTime: Date.now()
    }
  });
  await writeLog(db, {
    orderId: id, orderNo: o.orderNo, _openid: o._openid,
    action: 'ship', fromStatus: 2, toStatus: 3,
    operator: event._openid, operatorType: 'admin',
    remark: `配送员 ${name} ${phone}, 公司: ${company || '自有'}`
  });
  return ok();
});
