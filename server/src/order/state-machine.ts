import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { BizException } from '../common/biz-exception';
import { Prisma } from '@prisma/client';

const PREDEDUCT_KEY_PREFIX = 'stock:pre:';
const PREDEDUCT_TTL_SECONDS = 15 * 60;

// ===== 订单状态 =====
export type OrderStatus =
  | 'pending_payment'
  | 'pending_accept'
  | 'making'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunding'
  | 'refunded';

/**
 * 合法转换表（specs/02-domain.md §3.3）
 * key = 当前状态, value = 允许的目标状态集合
 */
const STATE_TRANSITIONS: Record<OrderStatus, Set<OrderStatus>> = {
  pending_payment: new Set(['pending_accept', 'cancelled']),
  pending_accept: new Set(['making', 'cancelled', 'refunding']),
  making: new Set(['ready', 'cancelled', 'refunding']),
  ready: new Set(['completed', 'refunding']),
  completed: new Set(),
  cancelled: new Set(),
  refunding: new Set(['refunded']),
  refunded: new Set(),
};

/**
 * 验证状态转换合法性
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATE_TRANSITIONS[from]?.has(to) ?? false;
}

export class StateTransitionError extends BizException {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(2002, `订单状态不允许从 ${from} 转换到 ${to}`, HttpStatus.OK);
  }
}
