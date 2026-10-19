import { describe, it, expect } from 'vitest';
import { extractMerchantId } from '../src/utils/scene';

describe('extractMerchantId', () => {
  it('decodes base64 scene (same format as server SceneCodec)', () => {
    const scene = Buffer.from('merchant_id=m001').toString('base64');
    expect(extractMerchantId(scene)).toBe('m001');
  });

  it('accepts plaintext scene', () => {
    expect(extractMerchantId('merchant_id=m001')).toBe('m001');
  });

  it('handles scene with other params', () => {
    const scene = Buffer.from('merchant_id=m001&table_id=t2').toString('base64');
    expect(extractMerchantId(scene)).toBe('m001');
  });

  it('returns null for missing/invalid scene', () => {
    expect(extractMerchantId('')).toBeNull();
    expect(extractMerchantId(null)).toBeNull();
    expect(extractMerchantId('%%%not-base64%%%')).toBeNull();
  });

  it('decodes non-ASCII payload without corrupting merchant_id match', () => {
    const scene = Buffer.from('门店=奶茶&merchant_id=m002').toString('base64');
    expect(extractMerchantId(scene)).toBe('m002');
  });
});
