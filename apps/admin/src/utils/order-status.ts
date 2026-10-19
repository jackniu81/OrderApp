import type { OrderStatus, PayMethod } from '../types';

/** 商家可见的状态集合与流转（specs/02-domain.md 状态机） */
export const ADMIN_ORDER_STATUSES: OrderStatus[] = [
  'pending_accept',
  'making',
  'ready',
  'completed',
  'cancelled',
  'refunding',
  'refunded',
];

export const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  pending_accept: '待接单',
  making: '制作中',
  ready: '可取餐',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
};

/** AntD Tag 颜色 */
export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: 'orange',
  pending_accept: 'red',
  making: 'blue',
  ready: 'green',
  completed: 'default',
  cancelled: 'default',
  refunding: 'gold',
  refunded: 'purple',
};

export const PAY_METHOD_TEXT: Record<PayMethod, string> = {
  wechat: '微信支付',
  on_site: '到店支付',
};

/** 商家当前可执行的操作（可取餐后由顾客确认取餐流转为 completed，状态机不允许商家取消） */
export function availableActions(status: OrderStatus): ('accept' | 'complete' | 'cancel')[] {
  if (status === 'pending_accept') return ['accept', 'cancel'];
  if (status === 'making') return ['complete', 'cancel'];
  return [];
}
