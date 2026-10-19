import { describe, it, expect } from 'vitest';
import { fenToYuan, formatPrice, formatTime } from '../src/utils/format';

describe('format', () => {
  it('converts fen to yuan string', () => {
    expect(fenToYuan(0)).toBe('0.00');
    expect(fenToYuan(1500)).toBe('15.00');
    expect(fenToYuan(15)).toBe('0.15');
  });

  it('formats price with ¥ prefix', () => {
    expect(formatPrice(1880)).toBe('¥18.80');
  });

  it('formats local date-time as MM-DD HH:mm', () => {
    // 无时区后缀的 ISO 串按本地时间解析，结果不受运行时区影响
    expect(formatTime('2026-10-19T08:13:00')).toBe('10-19 08:13');
    expect(formatTime('2026-01-05T23:59:00')).toBe('01-05 23:59');
  });

  it('returns dash for missing or invalid time', () => {
    expect(formatTime(null)).toBe('-');
    expect(formatTime('')).toBe('-');
    expect(formatTime('not-a-date')).toBe('-');
  });
});
