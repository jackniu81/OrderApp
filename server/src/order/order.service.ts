import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { BizException } from '../common/biz-exception';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canTransition, StateTransitionError, OrderStatus } from './state-machine';

export const EVENT_BUS = 'EVENT_BUS';

const PREDEDUCT_KEY_PREFIX = 'stock:pre:';
const PREDEDUCT_TTL_SECONDS = 15 * 60; // 15 分钟超时

/**
 * 下单参数
 */
export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  specs: { groupId: string; optionIds: string[] }[];
  remark?: string;
}

export interface CreateOrderInput {
  merchantId: string;
  openid: string;
  items: CreateOrderItemInput[];
  remark?: string;
  payMethod: 'wechat' | 'on_site';
}

/**
 * 全局唯一订单号生成
 * 格式: m{merchantId}_{YYYYMMDDHHmmss}_{4位序号}
 */
function genOutTradeNo(merchantId: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000).toString();
  return `m${merchantId}_${ts}_${rand}`;
}

function genOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ord${ts}${rand}`.slice(0, 32);
}

function genOrderItemId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `oi${ts}${rand}`.slice(0, 32);
}

type ProductWithSpecs = Prisma.ProductGetPayload<{
  include: {
    specGroups: {
      include: {
        specGroup: {
          include: { options: true };
        };
      };
    };
  };
}>;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional() @Inject(EVENT_BUS) private readonly eventBus?: EventEmitter,
  ) {}

  /**
   * 创建订单（仅预扣库存，支付成功后 Issue #4 会转为正式扣减）
   *
   * 流程:
   *   1. 校验门店存在 + 营业中
   *   2. 校验商品存在 + 上架中 + 规格合法
   *   3. 计算小计/总价
   *   4. Redis 原子预扣库存（DECR，失败回滚 + 报 2001）
   *   5. 开启 15 分钟 TTL（Redis EXPIRE 记录预扣，超时释放）
   *   6. 事务内落库 order + order_item（存快照）
   *   7. upsert user（openid 匿名顾客）
   *   8. 预扣清单写 Redis list，超时自动回滚
   */
  async createOrder(input: CreateOrderInput) {
    const { merchantId, openid, items, remark, payMethod } = input;

    // 1. 门店校验
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new BizException(1004, '门店不存在', HttpStatus.OK);
    }
    if (!merchant.isOpen) {
      throw new BizException(2000, '门店已打烊，暂停下单', HttpStatus.OK);
    }

    // 2. 加载所有商品（含规格）
    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, merchantId },
      include: {
        specGroups: {
          include: {
            specGroup: { include: { options: true } },
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new BizException(2003, '部分商品不存在或已下架', HttpStatus.OK);
    }
    for (const p of products) {
      if (!p.onSale) throw new BizException(2003, `${p.name} 已下架`, HttpStatus.OK);
    }

    // 3. 校验规格 + 计算小计
    let totalAmount = 0;
    const itemsWithSnapshot = await Promise.all(
      items.map(async (item) => {
        const product = products.find((p) => p.id === item.productId)!;

        if (item.quantity <= 0) {
          throw new BizException(1001, '商品数量必须大于 0', HttpStatus.OK);
        }
        if (item.quantity > product.stock) {
          throw new BizException(2001, `${product.name} 库存不足`, HttpStatus.OK);
        }

        let specPriceDelta = 0;
        const specParts: string[] = [];

        for (const specInput of item.specs) {
          const sg = product.specGroups.find((g) => g.specGroup.id === specInput.groupId);
          if (!sg) {
            throw new BizException(1001, `规格组 ${specInput.groupId} 不属于该商品`, HttpStatus.OK);
          }

          // 必填校验
          if (sg.specGroup.required && specInput.optionIds.length === 0) {
            throw new BizException(1001, `${sg.specGroup.name} 为必填项`, HttpStatus.OK);
          }

          // 单/多选校验
          if (sg.specGroup.type === 'single' && specInput.optionIds.length > 1) {
            throw new BizException(1001, `${sg.specGroup.name} 只能单选`, HttpStatus.OK);
          }

          const optionNames: string[] = [];
          for (const optId of specInput.optionIds) {
            const opt = sg.specGroup.options.find((o) => o.id === optId);
            if (!opt) {
              throw new BizException(1001, `规格选项 ${optId} 不存在`, HttpStatus.OK);
            }
            optionNames.push(opt.name);
            specPriceDelta += opt.priceDelta;
          }
          specParts.push(`${sg.specGroup.name}：${optionNames.join(' + ')}`);
        }

        const subtotal = (product.price + specPriceDelta) * item.quantity;
        totalAmount += subtotal;

        return {
          productId: product.id,
          productName: product.name,
          productImage: product.image,
          price: product.price + specPriceDelta,
          quantity: item.quantity,
          specSnapshot: specParts.join(' / ') || null,
          remark: item.remark || null,
          subtotal,
        };
      }),
    );

    // 4. Redis 预扣库存（原子 DECR）
    // 预扣 key: stock:pre:{productId}
    const preDeductOps: { productId: string; quantity: number }[] = [];
    for (const item of items) {
      const key = PREDEDUCT_KEY_PREFIX + item.productId;
      const remaining = await this.redis.client.decrby(key, item.quantity);
      if (remaining < 0) {
        // 回滚所有已预扣
        for (const op of preDeductOps) {
          await this.redis.client.incrby(PREDEDUCT_KEY_PREFIX + op.productId, op.quantity);
        }
        throw new BizException(2001, '库存不足', HttpStatus.OK);
      }
      // 设置 TTL，超时自动释放（通过定时任务扫描，这里加 TTL 做兜底）
      await this.redis.client.expire(key, PREDEDUCT_TTL_SECONDS);
      preDeductOps.push({ productId: item.productId, quantity: item.quantity });
    }

    // 5. 落库
    const outTradeNo = genOutTradeNo(merchantId);
    const orderId = genOrderId();
    const now = new Date();

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // 正式扣减 DB 库存（乐观锁 CAS）
        for (const op of preDeductOps) {
          const result = await tx.product.updateMany({
            where: { id: op.productId, stock: { gte: op.quantity } },
            data: { stock: { decrement: op.quantity } },
          });
          if (result.count === 0) {
            throw new Error('STOCK_CAS_FAILED');
          }
        }

        // 写订单
        const order = await tx.order.create({
          data: {
            id: orderId,
            outTradeNo,
            merchantId,
            openid,
            status: 'pending_payment',
            totalAmount,
            payMethod,
            payStatus: payMethod === 'on_site' ? 'pending' : 'unpaid',
            remark: remark || null,
            createdAt: now,
          },
        });

        // 写订单明细
        await tx.orderItem.createMany({
          data: itemsWithSnapshot.map((item, idx) => ({
            id: genOrderItemId() + idx,
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            price: item.price,
            quantity: item.quantity,
            specSnapshot: item.specSnapshot,
            remark: item.remark,
            subtotal: item.subtotal,
          })),
        });

        // upsert 匿名顾客
        await tx.user.upsert({
          where: { openid },
          create: { openid, createdAt: now },
          update: {},
        });

        return order;
      });

      // 预扣成功后记录订单号用于超时回滚扫描
      await this.redis.client.setex(
        `order:created:${order.id}`,
        PREDEDUCT_TTL_SECONDS,
        JSON.stringify({ merchantId, preDeductOps }),
      );

      this.logger.log(`订单创建: orderId=${order.id}, outTradeNo=${outTradeNo}, amount=${totalAmount}`);

      return {
        orderId: order.id,
        outTradeNo,
        totalAmount,
        status: order.status,
      };
    } catch (err) {
      // DB 失败，回滚 Redis 预扣
      for (const op of preDeductOps) {
        await this.redis.client.incrby(PREDEDUCT_KEY_PREFIX + op.productId, op.quantity);
      }
      this.logger.error(`订单创建失败: ${err}`);
      if (err instanceof Error && err.message === 'STOCK_CAS_FAILED') {
        throw new BizException(2001, '库存不足', HttpStatus.OK);
      }
      throw new BizException(9999, '订单创建失败', HttpStatus.OK);
    }
  }

  /**
   * 释放预扣库存（订单取消/超时）
   */
  async releasePreDeduction(
    orderId: string,
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    for (const item of items) {
      await this.redis.client.incrby(PREDEDUCT_KEY_PREFIX + item.productId, item.quantity);
    }
    await this.redis.client.del(`order:created:${orderId}`);
    this.logger.log(`预扣释放: orderId=${orderId}`);
  }

  // ===== 状态机 =====

  private async transition(
    orderId: string,
    targetStatus: OrderStatus,
    ctx: { update?: any; emit?: boolean } = {},
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(1004, '订单不存在', HttpStatus.OK);

    const from = order.status as OrderStatus;
    if (!canTransition(from, targetStatus)) {
      throw new StateTransitionError(from, targetStatus);
    }

    const data: any = { status: targetStatus, ...(ctx.update || {}) };
    const updated = await this.prisma.order.update({ where: { id: orderId }, data });

    this.logger.log(`订单状态流转: ${orderId} ${from} → ${targetStatus}`);

    if (ctx.emit !== false) {
      this.eventBus?.emit('order:status', {
        orderId,
        status: targetStatus,
        merchantId: order.merchantId,
        openid: order.openid,
        updatedAt: new Date(),
      });
    }

    return updated;
  }

  /** 商家接单: pending_accept → making */
  async accept(orderId: string) {
    return this.transition(orderId, 'making', { update: { acceptedAt: new Date() } });
  }

  /** 商家完成: making → ready（可取餐） */
  async complete(orderId: string) {
    return this.transition(orderId, 'ready');
  }

  /** 确认取餐: ready → completed */
  async finish(orderId: string) {
    return this.transition(orderId, 'completed', { update: { completedAt: new Date() } });
  }

  /**
   * 取消订单
   * - pending_payment → cancelled: 释放预扣
   * - pending_accept → cancelled: 已支付则自动退款 + 释放库存
   * - making → cancelled: 已支付则自动退款
   */
  async cancel(orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new BizException(1004, '订单不存在', HttpStatus.OK);

    const from = order.status as OrderStatus;
    if (!canTransition(from, 'cancelled')) {
      throw new StateTransitionError(from, 'cancelled');
    }

    // 状态流转
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
    });

    this.logger.log(`订单取消: ${orderId}, reason=${reason}, from=${from}`);

    // 副作用: 释放预扣库存（pending_payment 阶段）
    if (from === 'pending_payment') {
      await this.releasePreDeduction(
        orderId,
        order.items.map((it: any) => ({ productId: it.productId, quantity: it.quantity })),
      );
    }

    // 副作用: 已支付自动退款（Issue #4 PaymentService 已写 TODO，这里标待接）
    if (order.payStatus === 'paid') {
      this.logger.warn(`已支付订单 ${orderId} 取消，待接入 PaymentService 退款 API`);
      // TODO: 调 PaymentService.refund(order.outTradeNo, order.totalAmount)
    }

    return updated;
  }

  /** 查询订单详情 */
  async getById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new BizException(1004, '订单不存在', HttpStatus.OK);
    return order;
  }

  /**
   * 商家端订单详情（校验归属）
   * 订单不存在 → 1004；属于其他门店 → 1003
   */
  async getForMerchant(orderId: string, merchantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new BizException(1004, '订单不存在', HttpStatus.OK);
    if (order.merchantId !== merchantId) {
      throw new BizException(1003, '无权操作该订单', HttpStatus.FORBIDDEN);
    }
    return order;
  }

  /** 顾客订单列表 */
  async listByOpenid(openid: string, page: number, pageSize: number) {
    const where = { openid };
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /** 商家订单列表 */
  async listByMerchant(merchantId: string, status?: string, page = 1, pageSize = 20) {
    const where: any = { merchantId };
    if (status) where.status = status;
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }
}
