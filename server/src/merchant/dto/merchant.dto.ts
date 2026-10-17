import { IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GET /api/v1/merchant/resolve?scene=xxx
 * 顾客扫码/入口识别门店
 */
export class ResolveMerchantQueryDto {
  @IsString()
  @IsNotEmpty()
  scene!: string;
}

/**
 * GET /api/v1/merchant/:id
 */
export class GetMerchantParamDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

/**
 * PUT /api/v1/merchant/:id
 * 商家后台更新门店设置
 */
export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  businessHours?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  payOnSiteEnabled?: boolean;

  @IsOptional()
  @IsString()
  notice?: string;
}
