import { request } from './request';
import { currentMerchantId } from '../utils/params';
import type { MerchantInfo } from '../types';

/** GET /merchant/:id 门店信息（specs/03-api.md §3.2，顾客端也复用，无需鉴权） */
export function getMerchant(): Promise<MerchantInfo> {
  return request<MerchantInfo>(`/merchant/${encodeURIComponent(currentMerchantId())}`);
}

/** PUT /merchant/:id 更新营业设置（specs/03-api.md §3.3，商家端） */
export function updateMerchant(input: Partial<MerchantInfo>): Promise<MerchantInfo> {
  return request<MerchantInfo>(`/merchant/${encodeURIComponent(currentMerchantId())}`, {
    method: 'PUT',
    body: input,
  });
}
