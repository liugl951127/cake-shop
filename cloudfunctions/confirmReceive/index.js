const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const order = await db.collection('orders').doc(id).get();
  if (!order.data) throw new BizError('订单不存在');
  if (order.data.status !== 3) throw new BizError('订单状态不允许此操作');
  await db.collection('orders').doc(id).update({
    data: { status: 4, updateTime: Date.now() }
  });
  return ok();
});
