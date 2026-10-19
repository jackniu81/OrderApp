import { useSyncExternalStore } from 'react';
import Taro from '@tarojs/taro';
import {
  CartLine,
  AddItemInput,
  addLine,
  changeQty as changeQtyOps,
  removeLine as removeLineOps,
  syncStock as syncStockOps,
  totals as totalsOps,
  StockInfo,
} from './cart-ops';

export type { CartLine, AddItemInput } from './cart-ops';
export { lineKey, totals } from './cart-ops';

type Listener = () => void;

class CartStore {
  private merchantId = '';
  private lines: CartLine[] = [];
  private listeners = new Set<Listener>();

  init(merchantId: string) {
    if (this.merchantId === merchantId) return;
    this.merchantId = merchantId;
    const stored = Taro.getStorageSync(this.storageKey());
    this.lines = Array.isArray(stored) ? stored : [];
    this.notify();
  }

  private storageKey() {
    return `cart_${this.merchantId}`;
  }

  private persist() {
    Taro.setStorageSync(this.storageKey(), this.lines);
  }

  private notify() {
    this.persist();
    this.listeners.forEach((fn) => fn());
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getLines = () => this.lines;

  add(item: AddItemInput, quantity = 1) {
    this.lines = addLine(this.lines, item, quantity);
    this.notify();
  }

  changeQty(key: string, delta: number) {
    this.lines = changeQtyOps(this.lines, key, delta);
    this.notify();
  }

  remove(key: string) {
    this.lines = removeLineOps(this.lines, key);
    this.notify();
  }

  clear() {
    this.lines = [];
    this.notify();
  }

  /** 菜单加载后做库存对齐，返回被移除的商品名 */
  syncStock(stockMap: Map<string, StockInfo>): string[] {
    const { lines, removedNames } = syncStockOps(this.lines, stockMap);
    this.lines = lines;
    if (removedNames.length > 0) this.notify();
    return removedNames;
  }

  totals() {
    return totalsOps(this.lines);
  }
}

export const cart = new CartStore();

export function useCart(): CartLine[] {
  return useSyncExternalStore(cart.subscribe, cart.getLines);
}
