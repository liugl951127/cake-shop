const { cloud, ok, BizError, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const { id, remove } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const _ = db.command;

  if (remove) {
    // 物理删除(已完成订单)
    await db.collection('orders').doc(id).remove();
    return ok();
  }

  // 查询订单
  const order = await db.collection('orders').doc(id).get();
  if (!order.data) throw new BizError('订单不存在');
  if (order.data.status > 0) throw new BizError('订单已进入制作流程,无法取消');

  // 恢复库存
  for (const it of order.data.items) {
    await db.collection('goods').doc(it._id).update({
      data: { stock: _.inc(it.count), sales: _.inc(-it.count) }
    }).catch(() => {});
  }

  await db.collection('orders').doc(id).update({
    data: { status: -1, updateTime: Date.now() }
  });
  return ok();
});
