const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { id } = event;
  if (!id) throw new BizError('id 必填');
  const db = cloud.database();
  const data = { updateTime: Date.now() };
  ['name','desc','price','originPrice','image','images','category','stock','recommend','tags','detail','detailImages','status','specs']
    .forEach(k => { if (event[k] !== undefined) data[k] = event[k]; });
  if (data.price) data.price = Number(data.price);
  if (data.originPrice) data.originPrice = Number(data.originPrice);
  if (data.stock !== undefined) data.stock = Number(data.stock);
  await db.collection('goods').doc(id).update({ data });
  return ok();
});
