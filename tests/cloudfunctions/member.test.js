// 单元测试 - 会员系统
const sdk = require('../mocks/wx-server-sdk');
jest.mock('wx-server-sdk', () => sdk);

const member = require('../../cloudfunctions/common/member.js');

describe('会员系统 - 等级规则', () => {
  beforeEach(() => sdk.__reset());

  test('普通会员 (0 成长值)', () => {
    const lv = member.getLevel(0);
    expect(lv.level).toBe(0);
    expect(lv.name).toBe('普通会员');
    expect(lv.discount).toBe(1.0);
  });

  test('银卡会员 (100 成长值)', () => {
    const lv = member.getLevel(100);
    expect(lv.level).toBe(1);
    expect(lv.discount).toBe(0.98);
  });

  test('金卡会员 (500 成长值)', () => {
    const lv = member.getLevel(500);
    expect(lv.level).toBe(2);
    expect(lv.discount).toBe(0.95);
  });

  test('钻石会员 (2000 成长值)', () => {
    const lv = member.getLevel(2000);
    expect(lv.level).toBe(3);
    expect(lv.discount).toBe(0.9);
  });

  test('成长值 50 应为普通会员', () => {
    expect(member.getLevel(50).level).toBe(0);
  });

  test('成长值 99 仍为普通,100 升级银卡', () => {
    expect(member.getLevel(99).level).toBe(0);
    expect(member.getLevel(100).level).toBe(1);
  });
});

describe('会员系统 - 下一等级', () => {
  test('普通会员下一级是银卡', () => {
    const next = member.getNextLevel(0);
    expect(next.level).toBe(1);
    expect(next.min).toBe(100);
  });

  test('银卡会员下一级是金卡', () => {
    const next = member.getNextLevel(150);
    expect(next.level).toBe(2);
    expect(next.min).toBe(500);
  });

  test('钻石会员无下一级', () => {
    const next = member.getNextLevel(3000);
    expect(next).toBeNull();
  });
});

describe('会员系统 - 折扣计算', () => {
  test('普通会员不打折', () => {
    expect(member.calcDiscount(0, 100)).toBe(100);
  });

  test('银卡 98 折', () => {
    expect(member.calcDiscount(1, 100)).toBe(98);
  });

  test('金卡 95 折', () => {
    expect(member.calcDiscount(2, 100)).toBe(95);
  });

  test('钻石 9 折', () => {
    expect(member.calcDiscount(3, 100)).toBe(90);
  });

  test('精度:小数 99.9', () => {
    expect(member.calcDiscount(1, 99.9)).toBe(97.90);
  });
});

describe('会员系统 - 成长值/积分', () => {
  test('消费 100 元获得 100 成长值', () => {
    expect(member.addGrowth(0, 100)).toBe(100);
  });

  test('已有 50 成长值,再消费 100 变 150', () => {
    expect(member.addGrowth(50, 100)).toBe(150);
  });

  test('消费 100 元获得 100 积分', () => {
    expect(member.addPoints(0, 100)).toBe(100);
  });

  test('积分取整(消费 99.9 元)', () => {
    expect(member.addPoints(0, 99.9)).toBe(99);
  });
});
