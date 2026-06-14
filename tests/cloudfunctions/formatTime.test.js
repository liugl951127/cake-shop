// 单元测试 - 工具函数
const { formatTime } = require('../../cloudfunctions/common/formatTime.js');

describe('formatTime', () => {
  test('格式化 YYYY-MM-DD', () => {
    const d = new Date('2024-03-15T10:30:45');
    expect(formatTime(d, 'YYYY-MM-DD')).toBe('2024-03-15');
  });

  test('格式化 HH:mm:ss', () => {
    const d = new Date('2024-03-15T10:30:45');
    expect(formatTime(d, 'HH:mm:ss')).toBe('10:30:45');
  });

  test('完整格式', () => {
    const d = new Date('2024-03-15T10:30:45');
    expect(formatTime(d, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-03-15 10:30:45');
  });

  test('单位数补零', () => {
    const d = new Date('2024-01-05T08:09:07');
    expect(formatTime(d, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-01-05 08:09:07');
  });

  test('接收时间戳', () => {
    const ts = new Date('2024-03-15T10:30:45').getTime();
    expect(formatTime(ts, 'YYYY-MM-DD')).toBe('2024-03-15');
  });

  test('默认格式', () => {
    const d = new Date('2024-03-15T10:30:45');
    expect(formatTime(d)).toBe('2024-03-15 10:30:45');
  });
});
