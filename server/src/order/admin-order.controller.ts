import { Controller, Post, Get, Param, Body, Query, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OrderService } from './order.service';
import { PrintService } from '../print/print.service';
import { BizException } from '../common/biz-exception';
import { AdminAuthGuard, AdminPrincipal } from '../auth/admin-auth.guard';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

class CancelOrderDto {
  @IsString() @IsNotEmpty() reason!: string;
}

class PrintOrderDto {
  @IsOptional() @IsString() printerId?: string;
}

interface ApiResponse<T> { code: number; message: string; data: T; }

const ADMIN_ORDER_STATUSES = [
  'pending_payment',
  'pending_accept',
  'making',
  'ready',
  'completed',
  'cancelled',
  'refunding',
  'refunded',
];

/**
 * 商家端订单管理（specs/03-api.md §6.4-6.7 + §8.3，F-07）
 */
@UseGuards(AdminAuthGuard)
@Controller('admin/orders')
export class AdminOrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly printService: PrintService,
  ) {}

  /** GET /admin/orders?merchantId=xxx&status=xxx&page=1&pageSize=20 商家订单列表 */
  @Get()
  @HttpCode(200)
  async list(
    @Query('merchantId') merchantId: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ApiResponse<unknown>> {
    if (!merchantId) {
      throw new BizException(1001, 'merchantId 不能为空', HttpStatus.OK);
    }
    if (status && !ADMIN_ORDER_STATUSES.includes(status)) {
      throw new BizException(1001, `status 不合法，可选: ${ADMIN_ORDER_STATUSES.join(' / ')}`, HttpStatus.OK);
    }
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const data = await this.orderService.listByMerchant(merchantId, status, p, ps);
    return { code: 0, message: 'ok', data };
  }

  /** GET /admin/orders/:id 商家订单详情（仅限本门店订单） */
  @Get(':id')
  @HttpCode(200)
  async detail(
    @Param('id') id: string,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.getForMerchant(id, req.admin!.merchantId);
    return { code: 0, message: 'ok', data };
  }

  /** POST /admin/orders/:id/accept 商家接单（WS 推送顾客） */
  @Post(':id/accept') @HttpCode(200)
  async accept(
    @Param('id') id: string,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    await this.assertOwned(id, req);
    const data = await this.orderService.accept(id);
    return { code: 0, message: 'ok', data };
  }

  /** POST /admin/orders/:id/complete 商家完成（制作完成，可取餐） */
  @Post(':id/complete') @HttpCode(200)
  async complete(
    @Param('id') id: string,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    await this.assertOwned(id, req);
    const data = await this.orderService.complete(id);
    return { code: 0, message: 'ok', data };
  }

  /** POST /admin/orders/:id/cancel 商家取消订单 */
  @Post(':id/cancel') @HttpCode(200)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    await this.assertOwned(id, req);
    const data = await this.orderService.cancel(id, dto.reason);
    return { code: 0, message: 'ok', data };
  }

  /** POST /admin/orders/:id/confirm-payment 到店收款确认（仅 on_site 待支付订单） */
  @Post(':id/confirm-payment') @HttpCode(200)
  async confirmPayment(
    @Param('id') id: string,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    await this.assertOwned(id, req);
    const data = await this.orderService.confirmOnSitePayment(id);
    return { code: 0, message: 'ok', data };
  }

  /** POST /admin/orders/:id/print 打印小票（未配置/离线返回 4001） */
  @Post(':id/print') @HttpCode(200)
  async print(
    @Param('id') id: string,
    @Body() dto: PrintOrderDto,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    await this.assertOwned(id, req);
    const data = await this.printService.printOrder(id, dto?.printerId);
    return { code: 0, message: 'ok', data };
  }

  private async assertOwned(orderId: string, req: Request & { admin?: AdminPrincipal }): Promise<void> {
    await this.orderService.getForMerchant(orderId, req.admin!.merchantId);
  }
}
