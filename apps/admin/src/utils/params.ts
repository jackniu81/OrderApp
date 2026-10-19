import { getSession } from './session';

/** 当前登录账号所属门店（token 携带，接口请求统一从这里取） */
export function currentMerchantId(): string {
  return getSession()?.merchantId ?? '';
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
