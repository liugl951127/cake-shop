const { cloud, ok, BizError, auth } = require('../common/index.js');

function genOrderNo() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  return stamp + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

exports.main = auth(async (event) => {
  const { items, address, remark, timeText, goodsPrice, freight, totalPrice } = event;
  if (!items || items.length === 0) throw new BizError('订单无商品');
  if (!address) throw new BizError('请选择地址');

  const db = cloud.database();
  const _ = db.command;

  // 校验库存
  for (const it of items) {
    const g = await db.collection('goods').doc(it._id).get();
    if (!g.data) throw new BizError(`商品已下架: ${it.name}`);
    if (g.data.stock < it.count) throw new BizError(`${it.name} 库存不足`);
  }

  // 扣减库存
  for (const it of items) {
    await db.collection('goods').doc(it._id).update({
      data: { stock: _.inc(-it.count), sales: _.inc(it.count) }
    });
  }

  const now = Date.now();
  const orderNo = genOrderNo();
  const res = await db.collection('orders').add({
    data: {
      _openid: event._openid,
      orderNo,
      items,
      address,
      remark: remark || '',
      timeText: timeText || '尽快送达',
      goodsPrice: Number(goodsPrice) || 0,
      freight: Number(freight) || 0,
      totalPrice: Number(totalPrice) || 0,
      status: 0,  // 0 待付款
      createTime: now,
      updateTime: now
    }
  });

  return ok({ _id: res._id, orderNo });
});
