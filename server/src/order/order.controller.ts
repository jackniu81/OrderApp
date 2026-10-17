import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { OrderService, CreateOrderInput } from './order.service';
import { IsString, IsNotEmpty, IsInt, Min, IsIn, ValidateNested, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class SpecOptionDto {
  @IsString()
  @IsNotEmpty()
  groupId!: string;

  @IsArray()
  @IsString({ each: true })
  optionIds!: string[];
}

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecOptionDto)
  specs!: SpecOptionDto[];

  @IsOptional()
  @IsString()
  remark?: string;
}

class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  merchantId!: string;

  // TODO: 从 JWT token 中取 openid，当前由前端传入临时兼容
  @IsString()
  @IsNotEmpty()
  openid!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsString()
  remark?: string;

  @IsIn(['wechat', 'on_site'])
  payMethod!: 'wechat' | 'on_site';
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * POST /api/v1/orders
   * 创建订单（预扣库存 + 生成 outTradeNo）
   */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateOrderDto): Promise<ApiResponse<unknown>> {
    const data = await this.orderService.createOrder(dto as CreateOrderInput);
    return { code: 0, message: 'ok', data };
  }
}
