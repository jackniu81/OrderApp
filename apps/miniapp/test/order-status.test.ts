import { describe, it, expect } from 'vitest';
import {
  PROGRESS_STEPS,
  canFinish,
  isOngoing,
  progressIndex,
  statusHint,
  statusText,
} from '../src/utils/order-status';

describe('order-status', () => {
  it('maps every status to display text', () => {
    expect(statusText('pending_payment')).toBe('待支付');
    expect(statusText('pending_accept')).toBe('待接单');
    expect(statusText('making')).toBe('制作中');
    expect(statusText('ready')).toBe('待取餐');
    expect(statusText('completed')).toBe('已完成');
    expect(statusText('cancelled')).toBe('已取消');
    expect(statusText('refunding')).toBe('退款中');
    expect(statusText('refunded')).toBe('已退款');
  });

  it('falls back for unknown status', () => {
    expect(statusText('bogus' as any)).toBe('未知状态');
    expect(statusHint('bogus' as any)).toBe('');
  });

  it('treats completed/cancelled/refunded as settled', () => {
    expect(isOngoing('pending_payment')).toBe(true);
    expect(isOngoing('making')).toBe(true);
    expect(isOngoing('refunding')).toBe(true);
    expect(isOngoing('completed')).toBe(false);
    expect(isOngoing('cancelled')).toBe(false);
    expect(isOngoing('refunded')).toBe(false);
  });

  it('only allows finish when ready', () => {
    expect(canFinish('ready')).toBe(true);
    expect(canFinish('making')).toBe(false);
    expect(canFinish('completed')).toBe(false);
  });

  it('maps progress index along the merchant flow', () => {
    expect(PROGRESS_STEPS).toEqual(['待接单', '制作中', '待取餐', '已完成']);
    expect(progressIndex('pending_accept')).toBe(0);
    expect(progressIndex('ready')).toBe(2);
    expect(progressIndex('completed')).toBe(3);
    // 未支付与取消/退款不参与进度条
    expect(progressIndex('pending_payment')).toBe(-1);
    expect(progressIndex('cancelled')).toBe(-1);
  });
});
