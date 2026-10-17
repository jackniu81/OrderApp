import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpCode,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsIn,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderService, CreateOrderInput } from './order.service';

// ===== DTOs =====
class SpecOptionDto {
  @IsString() @IsNotEmpty() groupId!: string;
  @IsArray() @IsString({ each: true }) optionIds!: string[];
}

class OrderItemDto {
  @IsString() @IsNotEmpty() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SpecOptionDto) specs!: SpecOptionDto[];
  @IsOptional() @IsString() remark?: string;
}

class CreateOrderDto {
  @IsString() @IsNotEmpty() merchantId!: string;
  @IsString() @IsNotEmpty() openid!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
  @IsOptional() @IsString() remark?: string;
  @IsIn(['wechat', 'on_site']) payMethod!: 'wechat' | 'on_site';
}

class CancelOrderDto {
  @IsString() @IsNotEmpty() reason!: string;
}

interface ApiResponse<T> { code: number; message: string; data: T; }

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** POST /orders 创建订单 */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateOrderDto): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.createOrder(dto as CreateOrderInput);
    return { code: 0, message: 'ok', data };
  }

  /** GET /orders/:id 订单详情 */
  @Get(':id')
  @HttpCode(200)
  async getById(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.getById(id);
    return { code: 0, message: 'ok', data };
  }

  /** GET /orders?openid=xxx&page=1 顾客订单列表 */
  @Get()
  @HttpCode(200)
  async list(
    @Query('openid') openid: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ApiResponse<unknown>> {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const data = openid
      ? await this.orderService.listByOpenid(openid, p, ps)
      : { list: [], total: 0, page: p, pageSize: ps };
    return { code: 0, message: 'ok', data };
  }

  /** POST /orders/:id/accept 商家接单 */
  @Post(':id/accept') @HttpCode(200)
  async accept(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.accept(id);
    return { code: 0, message: 'ok', data };
  }

  /** POST /orders/:id/complete 商家完成 */
  @Post(':id/complete') @HttpCode(200)
  async complete(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.complete(id);
    return { code: 0, message: 'ok', data };
  }

  /** POST /orders/:id/finish 确认取餐 */
  @Post(':id/finish') @HttpCode(200)
  async finish(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.finish(id);
    return { code: 0, message: 'ok', data };
  }

  /** POST /orders/:id/cancel 取消订单 */
  @Post(':id/cancel') @HttpCode(200)
  async cancel(@Param('id') id: string, @Body() dto: CancelOrderDto): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.cancel(id, dto.reason);
    return { code: 0, message: 'ok', data };
  }
}
