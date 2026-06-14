// submitBulk - 企业 / 团采需求
// 团购: 满 N 件打折 + 开专票
const { cloud, ok, fail, auth } = require('../common/index.js');

exports.main = auth(async (event) => {
  const {
    companyName = '', contactName = '', contactPhone = '',
    itemList = [], totalCount = 0, budget = 0,
    needDate = '', address = '', needInvoice = false, remark = ''
  } = event;

  if (!contactName || !contactPhone) return fail('联系人/电话必填');
  if (!/^1\d{10}$/.test(contactPhone)) return fail('手机号格式错误');
  if (!totalCount || totalCount < 10) return fail('团采起订 10 件');

  const now = Date.now();
  const order = {
    _openid: event._openid,
    _userId: event._userId,
    type: 'bulk',
    companyName,
    contactName,
    contactPhone,
    itemList,           // [{ goodsId, count, spec }]
    totalCount: Number(totalCount),
    budget: Number(budget) || 0,
    needDate,
    address,
    needInvoice: !!needInvoice,
    remark,
    status: 1,          // 1-待报价 2-已报价 3-已确认 4-制作中 5-已交付 0-已取消
    quotes: [],
    invoice: null,      // 申请开票信息
    createTime: now,
    updateTime: now
  };
  const res = await cloud.database().collection('bulkOrders').add({ data: order });

  // 同步推送通知给商家 / 销售
  await cloud.database().collection('messages').add({
    data: {
      type: 'bulk_new',
      title: '新团采需求',
      content: `${contactName} - ${companyName || '未填'} - ${totalCount}件`,
      relatedId: res._id,
      read: false,
      createTime: now
    }
  }).catch(() => {});

  return ok({ bulkId: res._id });
});
