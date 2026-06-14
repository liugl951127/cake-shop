// submitCustom - 蛋糕定制需求
// 字段: 类型(生日/婚礼/企业/聚会)、尺寸、口味、参考图、预算、联系人、配送时间
const { cloud, ok, fail, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const {
    type = 'birthday', size = '', flavor = '', description = '',
    images = [], budget = 0, contactName = '', contactPhone = '',
    needDate = '', address = '', quantity = 1
  } = event;

  if (!contactName || !contactPhone) return fail('联系人/电话必填');
  if (!/^1\d{10}$/.test(contactPhone)) return fail('手机号格式错误');
  if (description && description.length > 1000) return fail('描述 1000 字内');
  if (images.length > 9) return fail('参考图最多 9 张');

  const now = Date.now();
  const order = {
    _openid: event._openid,
    _userId: event._userId,
    type,                  // birthday/wedding/corporate/party
    size,                  // 6寸/8寸/10寸/12寸/双层/多层
    flavor,                // 草莓/巧克力/榴莲/水果/抹茶
    description,
    images,
    budget: Number(budget) || 0,
    contactName,
    contactPhone,
    needDate,              // 期望送达
    address,
    quantity: Number(quantity) || 1,
    status: 1,             // 1-待报价 2-已报价 3-已确认 4-已制作 5-已交付 0-已取消
    quotes: [],            // 商家报价列表
    createTime: now,
    updateTime: now
  };

  const res = await db().collection('customOrders').add({ data: order });
  return ok({ customId: res._id, ...order });
});

function db() { return cloud.database(); }
