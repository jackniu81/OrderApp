/** 分 → 元展示 */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

export function formatPrice(fen: number): string {
  return `¥${fenToYuan(fen)}`;
}
