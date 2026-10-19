/** 分 → 元（表单输入用元，接口传输用分） */
export function fenToYuan(fen: number): number {
  return Math.round(fen) / 100;
}

export function yuanToFen(yuan: number): number {
  return Math.round(Number(yuan) * 100);
}

export function formatPrice(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`;
}

const pad = (n: number) => `${n}`.padStart(2, '0');

export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
