import type { OrderStatus } from '../types';

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  pending_accept: '待接单',
  making: '制作中',
  ready: '待取餐',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
};

/** 详情页的状态副标题 */
const STATUS_HINT: Record<OrderStatus, string> = {
  pending_payment: '请在到店支付时出示订单号，或重新下单',
  pending_accept: '商家尚未接单，可随时取消',
  making: '商家正在制作，请耐心等待',
  ready: '已做好，请凭订单号到店取餐',
  completed: '订单已完成，感谢光临',
  cancelled: '订单已取消',
  refunding: '退款处理中，请稍后查看',
  refunded: '退款已完成',
};

/** 终态之外的都算「进行中」 */
const SETTLED: OrderStatus[] = ['completed', 'cancelled', 'refunded'];

export function statusText(status: OrderStatus): string {
  return STATUS_TEXT[status] ?? '未知状态';
}

export function statusHint(status: OrderStatus): string {
  return STATUS_HINT[status] ?? '';
}

export function isOngoing(status: OrderStatus): boolean {
  return !SETTLED.includes(status);
}

/** 仅待取餐时顾客可确认取餐 */
export function canFinish(status: OrderStatus): boolean {
  return status === 'ready';
}

/** 详情页进度条：未支付与终态不参与 */
export const PROGRESS_STEPS = ['待接单', '制作中', '待取餐', '已完成'];

const PROGRESS_INDEX: Partial<Record<OrderStatus, number>> = {
  pending_accept: 0,
  making: 1,
  ready: 2,
  completed: 3,
};

/** 返回当前所处步骤下标，未进入商家流程或已终态返回 -1 */
export function progressIndex(status: OrderStatus): number {
  return PROGRESS_INDEX[status] ?? -1;
}
