/** 分 → 元展示 */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

export function formatPrice(fen: number): string {
  return `¥${fenToYuan(fen)}`;
}

const pad = (n: number) => `${n}`.padStart(2, '0');

/** 服务端时间为 ISO 字符串 → 本地 MM-DD HH:mm */
export function formatTime(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
