// 单元测试 - 前端工具函数
const { formatTime, formatCountdown, orderStatusMap } = require('../../miniprogram/utils/util.js');

describe('前端 formatTime', () => {
  test('格式化', () => {
    const d = new Date('2024-03-15T10:30:45');
    expect(formatTime(d, 'MM-DD HH:mm')).toBe('03-15 10:30');
  });
});

describe('formatCountdown', () => {
  test('0 毫秒显示 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00');
  });

  test('负数显示 00:00', () => {
    expect(formatCountdown(-1000)).toBe('00:00');
  });

  test('59 秒', () => {
    expect(formatCountdown(59000)).toBe('00:59');
  });

  test('1 分钟 30 秒', () => {
    expect(formatCountdown(90000)).toBe('01:30');
  });

  test('10 分钟', () => {
    expect(formatCountdown(600000)).toBe('10:00');
  });

  test('补零', () => {
    expect(formatCountdown(5000)).toBe('00:05');
  });
});

describe('orderStatusMap - 订单状态机', () => {
  test('8 个状态(0/1/2/3/4/5/-1/-2)', () => {
    expect(Object.keys(orderStatusMap)).toHaveLength(8);
  });

  test('每个状态都有 text/color/desc', () => {
    for (const k of Object.keys(orderStatusMap)) {
      const s = orderStatusMap[k];
      expect(s.text).toBeTruthy();
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.desc).toBeTruthy();
    }
  });

  test('0 待付款', () => {
    expect(orderStatusMap[0].text).toBe('待付款');
  });

  test('-1 已取消', () => {
    expect(orderStatusMap[-1].text).toBe('已取消');
  });
});
