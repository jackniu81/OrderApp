import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Response, Request } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /api/v1/payment/wx-notify
   * 微信 V3 支付回调（JSON body）
   * 返回微信规范 JSON: { code: "SUCCESS" | "FAIL", message: "..." }
   */
  @Post('wx-notify')
  @HttpCode(200)
  async wxNotify(@Body() payload: any) {
    try {
      const result = await this.paymentService.handleWxNotify(payload);
      return result;
    } catch (err: any) {
      // 兜底：回调处理不应阻塞微信重试
      return { code: 'FAIL', message: err?.message || '服务器错误' };
    }
  }

  /**
   * GET /api/v1/payment/:outTradeNo/status
   * 查询支付状态
   */
  @Get(':outTradeNo/status')
  @HttpCode(200)
  async getStatus(@Param('outTradeNo') outTradeNo: string): Promise<ApiResponse<unknown>> {
    const data = await this.paymentService.getStatus(outTradeNo);
    return { code: 0, message: 'ok', data };
  }
}
