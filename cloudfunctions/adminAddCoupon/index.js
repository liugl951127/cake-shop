// adminAddCoupon - 新增优惠券模板
const { cloud, ok, BizError, auth, requireAdmin } = require('../common/index.js');

exports.main = auth(async (event) => {
  requireAdmin(event);
  const { name, type, amount, discount, minAmount = 0, total = -1, perUserLimit = 1, validDays = 30, startTime, endTime } = event;
  if (!name) throw new BizError('名称必填');
  if (!type) throw new BizError('类型必填');

  const db = cloud.database();
  const res = await db.collection('coupons').add({
    data: {
      name, type: Number(type),
      amount: Number(amount) || 0,
      discount: Number(discount) || 0,
      minAmount: Number(minAmount) || 0,
      total: Number(total),
      claimed: 0,
      perUserLimit: Number(perUserLimit) || 1,
      validDays: Number(validDays) || 30,
      startTime: Number(startTime) || Date.now(),
      endTime: Number(endTime) || 0,
      status: 1,
      createTime: Date.now()
    }
  });
  return ok({ _id: res._id });
});
