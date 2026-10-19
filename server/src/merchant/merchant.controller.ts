import { Controller, Get, Put, Query, Param, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { MerchantService } from './merchant.service';
import { ResolveMerchantQueryDto, GetMerchantParamDto, UpdateMerchantDto } from './dto/merchant.dto';
import { BizException } from '../common/biz-exception';
import { AdminAuthGuard, AdminPrincipal } from '../auth/admin-auth.guard';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

type ResolveResult = {
  merchantId: string;
  merchantName: string;
  logo: string | null;
  isOpen: boolean;
  notice: string | null;
};

type PublicMerchant = {
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  businessHours: string | null;
  isOpen: boolean;
  payOnSiteEnabled: boolean;
  notice: string | null;
};

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  /**
   * GET /api/v1/merchant/resolve?scene=xxx
   * 顾客入口识别门店
   */
  @Get('resolve')
  @HttpCode(200)
  async resolve(@Query() query: ResolveMerchantQueryDto): Promise<ApiResponse<ResolveResult>> {
    const data = await this.merchantService.resolveByScene(query.scene);
    return { code: 0, message: 'ok', data };
  }

  /**
   * GET /api/v1/merchant/:id
   * 获取门店详情
   */
  @Get(':id')
  @HttpCode(200)
  async getById(@Param() param: GetMerchantParamDto): Promise<ApiResponse<PublicMerchant>> {
    const merchant = await this.merchantService.findById(param.id);
    return { code: 0, message: 'ok', data: this.merchantService.toPublicDto(merchant) };
  }

  /**
   * PUT /api/v1/merchant/:id
   * 更新门店设置（商家端）
   */
  @UseGuards(AdminAuthGuard)
  @Put(':id')
  @HttpCode(200)
  async update(
    @Param() param: GetMerchantParamDto,
    @Body() dto: UpdateMerchantDto,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<PublicMerchant>> {
    if (param.id !== req.admin!.merchantId) {
      throw new BizException(1003, '无权访问其他门店', HttpStatus.FORBIDDEN);
    }
    const merchant = await this.merchantService.update(param.id, dto);
    return { code: 0, message: 'ok', data: this.merchantService.toPublicDto(merchant) };
  }
}
