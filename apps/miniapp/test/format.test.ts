import { describe, it, expect } from 'vitest';
import { fenToYuan, formatPrice } from '../src/utils/format';

describe('format', () => {
  it('converts fen to yuan string', () => {
    expect(fenToYuan(0)).toBe('0.00');
    expect(fenToYuan(1500)).toBe('15.00');
    expect(fenToYuan(15)).toBe('0.15');
  });

  it('formats price with ¥ prefix', () => {
    expect(formatPrice(1880)).toBe('¥18.80');
  });
});
