import { request } from './request';
import { buildQuery, currentMerchantId } from '../utils/params';
import type { OrderInfo, OrderListResult, OrderStatus } from '../types';

/** 商家订单列表（specs/03-api.md §6.4） */
export function listOrders(params: { status?: OrderStatus; page?: number; pageSize?: number }): Promise<OrderListResult> {
  return request<OrderListResult>(
    `/admin/orders${buildQuery({ merchantId: currentMerchantId(), ...params })}`,
  );
}

/** 商家订单详情（specs/03-api.md §6.4） */
export function getOrder(id: string): Promise<OrderInfo> {
  return request<OrderInfo>(`/admin/orders/${encodeURIComponent(id)}`);
}

export function acceptOrder(id: string): Promise<OrderInfo> {
  return request<OrderInfo>(`/admin/orders/${encodeURIComponent(id)}/accept`, { method: 'POST', body: {} });
}

export function completeOrder(id: string): Promise<OrderInfo> {
  return request<OrderInfo>(`/admin/orders/${encodeURIComponent(id)}/complete`, { method: 'POST', body: {} });
}

/** 到店收款确认（specs/03-api.md §6.10），仅 on_site 待支付订单 */
export function confirmPaymentOrder(id: string): Promise<OrderInfo> {
  return request<OrderInfo>(`/admin/orders/${encodeURIComponent(id)}/confirm-payment`, { method: 'POST', body: {} });
}

export function cancelOrder(id: string, reason: string): Promise<OrderInfo> {
  return request<OrderInfo>(`/admin/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { reason } });
}

/** 打印小票（specs/03-api.md §8.3），未配置/离线为 4001 */
export function printOrder(id: string, printerId?: string): Promise<{ printId: string }> {
  return request(`/admin/orders/${encodeURIComponent(id)}/print`, {
    method: 'POST',
    body: printerId ? { printerId } : {},
  });
}
