import { afterEach, describe, expect, it } from 'vitest';
import { resolveImageUrl } from '../src/utils/image-url';

const ORIGINAL_ENV = process.env.TARO_ENV;

afterEach(() => {
  process.env.TARO_ENV = ORIGINAL_ENV;
});

describe('resolveImageUrl', () => {
  it('returns null for empty image', () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl('')).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
  });

  it('keeps absolute urls unchanged', () => {
    const url = 'https://cdn.example.com/p001.png';
    process.env.TARO_ENV = 'weapp';
    expect(resolveImageUrl(url)).toBe(url);
  });

  it('prefixes server-relative path with backend origin on weapp', () => {
    process.env.TARO_ENV = 'weapp';
    expect(resolveImageUrl('/api/v1/static/products/milk-tea.png')).toBe(
      'http://localhost:3000/api/v1/static/products/milk-tea.png',
    );
  });

  it('keeps relative path unchanged on h5 (dev server proxy)', () => {
    process.env.TARO_ENV = 'h5';
    expect(resolveImageUrl('/api/v1/static/products/milk-tea.png')).toBe(
      '/api/v1/static/products/milk-tea.png',
    );
  });

  it('returns non-path values unchanged', () => {
    process.env.TARO_ENV = 'weapp';
    expect(resolveImageUrl('assets/local.png')).toBe('assets/local.png');
  });
});
