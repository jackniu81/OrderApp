import { describe, it, expect } from 'vitest';
import {
  lineKey,
  addLine,
  changeQty,
  removeLine,
  syncStock,
  totals,
  type CartLine,
  type AddItemInput,
} from '../src/stores/cart-ops';

function item(over: Partial<AddItemInput> = {}): AddItemInput {
  return {
    productId: 'p001',
    name: '珍珠奶茶',
    image: null,
    basePrice: 1500,
    unitPrice: 1500,
    specs: [],
    specSnapshot: '',
    stock: 50,
    ...over,
  };
}

describe('lineKey', () => {
  it('same product + no specs → same key', () => {
    expect(lineKey('p001', [])).toBe(lineKey('p001', []));
  });

  it('optionIds order does not change key', () => {
    const a = lineKey('p001', [{ groupId: 'g1', optionIds: ['o2', 'o1'] }]);
    const b = lineKey('p001', [{ groupId: 'g1', optionIds: ['o1', 'o2'] }]);
    expect(a).toBe(b);
  });

  it('different specs → different key', () => {
    const a = lineKey('p001', [{ groupId: 'g1', optionIds: ['o1'] }]);
    const b = lineKey('p001', [{ groupId: 'g1', optionIds: ['o2'] }]);
    expect(a).not.toBe(b);
  });
});

describe('addLine', () => {
  it('merges same line and accumulates quantity', () => {
    let lines: CartLine[] = [];
    lines = addLine(lines, item());
    lines = addLine(lines, item(), 2);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it('keeps different spec lines separate', () => {
    let lines: CartLine[] = [];
    lines = addLine(lines, item({ specs: [{ groupId: 'g1', optionIds: ['o1'] }], unitPrice: 1800 }));
    lines = addLine(lines, item({ specs: [{ groupId: 'g1', optionIds: ['o2'] }], unitPrice: 1500 }));
    expect(lines).toHaveLength(2);
  });
});

describe('changeQty / removeLine', () => {
  const base = addLine([], item());

  it('increases quantity', () => {
    expect(changeQty(base, base[0].key, 1)[0].quantity).toBe(2);
  });

  it('removes line when quantity drops to 0', () => {
    expect(changeQty(base, base[0].key, -1)).toHaveLength(0);
  });

  it('clamped remove via removeLine', () => {
    expect(removeLine(base, base[0].key)).toHaveLength(0);
    expect(removeLine(base, 'not-exist')).toHaveLength(1);
  });
});

describe('syncStock', () => {
  const lines = [
    { ...item(), key: 'k1', quantity: 5 } as CartLine,
    { ...item({ productId: 'p002', name: '下架品' }), key: 'k2', quantity: 2 } as CartLine,
    { ...item({ productId: 'p003', name: '库存不足品' }), key: 'k3', quantity: 10 } as CartLine,
  ];

  it('removes off-sale/sold-out lines and trims insufficient stock', () => {
    const map = new Map([
      ['p001', { stock: 50, onSale: true, soldOut: false }],
      ['p002', { stock: 10, onSale: false, soldOut: false }],
      ['p003', { stock: 3, onSale: true, soldOut: false }],
    ]);
    const { lines: next, removedNames } = syncStock(lines, map);
    expect(removedNames).toEqual(['下架品']);
    expect(next.find((l) => l.key === 'k3')?.quantity).toBe(3);
    expect(next.find((l) => l.key === 'k1')?.quantity).toBe(5);
  });

  it('removes line when product disappears from menu', () => {
    const { lines: next, removedNames } = syncStock(lines, new Map());
    expect(next).toHaveLength(0);
    expect(removedNames).toHaveLength(3);
  });
});

describe('totals', () => {
  it('computes count and amount with spec delta', () => {
    const lines = [
      { ...item({ unitPrice: 1800 }), key: 'a', quantity: 2 } as CartLine,
      { ...item({ unitPrice: 1500 }), key: 'b', quantity: 1 } as CartLine,
    ];
    expect(totals(lines)).toEqual({ count: 3, amount: 5100 });
  });
});
