import type { OrderSpec } from '../types';

/** 购物车行：同一商品不同规格组合为不同行 */
export interface CartLine {
  key: string;
  productId: string;
  name: string;
  image: string | null;
  basePrice: number;
  /** 含规格加价的单价（分） */
  unitPrice: number;
  quantity: number;
  specs: OrderSpec[];
  /** 下单/展示用文本快照，如 "大杯/少糖" */
  specSnapshot: string;
  stock: number;
}

export interface AddItemInput {
  productId: string;
  name: string;
  image: string | null;
  basePrice: number;
  unitPrice: number;
  specs: OrderSpec[];
  specSnapshot: string;
  quantity?: number;
  stock: number;
}

export function lineKey(productId: string, specs: OrderSpec[]): string {
  const specPart = specs
    .map((s) => `${s.groupId}:${[...s.optionIds].sort().join(',')}`)
    .sort()
    .join('|');
  return `${productId}|${specPart}`;
}

export function addLine(lines: CartLine[], item: AddItemInput, quantity = 1): CartLine[] {
  const key = lineKey(item.productId, item.specs);
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) =>
      l.key === key ? { ...l, quantity: l.quantity + quantity, stock: item.stock } : l,
    );
  }
  return [
    ...lines,
    {
      key,
      productId: item.productId,
      name: item.name,
      image: item.image,
      basePrice: item.basePrice,
      unitPrice: item.unitPrice,
      quantity,
      specs: item.specs,
      specSnapshot: item.specSnapshot,
      stock: item.stock,
    },
  ];
}

/** 按 key 变更数量，delta 可为负；结果 <=0 时移除该行 */
export function changeQty(lines: CartLine[], key: string, delta: number): CartLine[] {
  const target = lines.find((l) => l.key === key);
  if (!target) return lines;
  const next = target.quantity + delta;
  if (next <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: next } : l));
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => l.key !== key);
}

export interface StockInfo {
  stock: number;
  onSale: boolean;
  soldOut: boolean;
}

/**
 * 菜单刷新后对齐购物车：下架/售罄/库存不足的行裁剪数量，裁剪到 0 则移除
 * 返回新行数组 + 被移除的商品名（供 toast）
 */
export function syncStock(
  lines: CartLine[],
  stockMap: Map<string, StockInfo>,
): { lines: CartLine[]; removedNames: string[] } {
  const removedNames: string[] = [];
  const next: CartLine[] = [];
  for (const l of lines) {
    const info = stockMap.get(l.productId);
    if (!info || !info.onSale || info.soldOut || info.stock <= 0) {
      removedNames.push(l.name);
      continue;
    }
    if (l.quantity > info.stock) {
      if (info.stock <= 0) {
        removedNames.push(l.name);
        continue;
      }
      next.push({ ...l, quantity: info.stock, stock: info.stock });
    } else {
      next.push({ ...l, stock: info.stock });
    }
  }
  return { lines: next, removedNames };
}

export function totals(lines: CartLine[]): { count: number; amount: number } {
  return lines.reduce(
    (acc, l) => ({ count: acc.count + l.quantity, amount: acc.amount + l.unitPrice * l.quantity }),
    { count: 0, amount: 0 },
  );
}
