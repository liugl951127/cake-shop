// 单元测试 - 优惠券
const sdk = require('../mocks/wx-server-sdk');
jest.mock('wx-server-sdk', () => sdk);

const { TYPES, lockCoupon, markCouponUsed, refundCoupon } = require('../../cloudfunctions/common/coupon.js');

describe('优惠券类型', () => {
  test('4 种类型映射', () => {
    expect(TYPES[1].name).toBe('满减券');
    expect(TYPES[2].name).toBe('折扣券');
    expect(TYPES[3].name).toBe('新人券');
    expect(TYPES[4].name).toBe('运费券');
  });
});

describe('lockCoupon - 锁定优惠券', () => {
  beforeEach(() => sdk.__reset());
  const db = () => sdk.database();

  test('满减券低于门槛应抛错', async () => {
    const dbase = db();
    await dbase.collection('coupons').add({
      data: { _id: 't1', name: '满100减10', type: 1, amount: 10, minAmount: 100, total: 100, claimed: 0 }
    });
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', couponId: 't1', status: 0 }
    });

    await expect(lockCoupon(dbase, 'cu1', 'u1', 'uid1', 50))
      .rejects.toThrow('满 100 才能使用');
  });

  test('已使用的券不能再次锁定', async () => {
    const dbase = db();
    await dbase.collection('coupons').add({ data: { _id: 't1', type: 1, amount: 10, minAmount: 0 } });
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', couponId: 't1', status: 1 }  // 已使用
    });
    await expect(lockCoupon(dbase, 'cu1', 'u1', 'uid1', 200)).rejects.toThrow('已使用');
  });

  test('已过期券不能锁定', async () => {
    const dbase = db();
    await dbase.collection('coupons').add({ data: { _id: 't1', type: 1, amount: 10, minAmount: 0 } });
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', couponId: 't1', status: 0, expireTime: Date.now() - 1000 }
    });
    await expect(lockCoupon(dbase, 'cu1', 'u1', 'uid1', 200)).rejects.toThrow('已过期');
  });

  test('非本人券不能锁定', async () => {
    const dbase = db();
    await dbase.collection('coupons').add({ data: { _id: 't1', type: 1, amount: 10, minAmount: 0 } });
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'other_user', couponId: 't1', status: 0 }
    });
    await expect(lockCoupon(dbase, 'cu1', 'u1', 'uid1', 200)).rejects.toThrow('不属于当前用户');
  });

  test('满减券正常锁定', async () => {
    const dbase = db();
    await dbase.collection('coupons').add({ data: { _id: 't1', name: '满100减10', type: 1, amount: 10, minAmount: 100 } });
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', couponId: 't1', status: 0 }
    });
    const r = await lockCoupon(dbase, 'cu1', 'u1', 'uid1', 200);
    expect(r.discount).toBe(10);
    // 状态变为锁定
    const cu = await dbase.collection('couponUsers').doc('cu1').get();
    expect(cu.data.status).toBe(2);
  });

  test('折扣券按比例计算', async () => {
    const dbase = db();
    await dbase.collection('coupons').add({
      data: { _id: 't1', name: '9折', type: 2, discount: 9, minAmount: 0 }
    });
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', couponId: 't1', status: 0 }
    });
    const r = await lockCoupon(dbase, 'cu1', 'u1', 'uid1', 100);
    expect(r.discount).toBe(10);  // 100 * (1 - 0.9) = 10
  });
});

describe('markCouponUsed / refundCoupon', () => {
  beforeEach(() => sdk.__reset());

  test('标记已用', async () => {
    const dbase = sdk.database();
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', status: 2 }
    });
    await markCouponUsed(dbase, 'cu1', 'uid1', 'order1');
    const cu = await dbase.collection('couponUsers').doc('cu1').get();
    expect(cu.data.status).toBe(1);
    expect(cu.data.orderId).toBe('order1');
  });

  test('退还到未使用', async () => {
    const dbase = sdk.database();
    await dbase.collection('couponUsers').add({
      data: { _id: 'cu1', _openid: 'u1', status: 2 }
    });
    await refundCoupon(dbase, 'cu1', 'uid1');
    const cu = await dbase.collection('couponUsers').doc('cu1').get();
    expect(cu.data.status).toBe(0);
  });
});
