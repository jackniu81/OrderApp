import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsIn, IsArray, Min, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

// ===== 分类 =====

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() merchantId!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() visible?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() visible?: boolean;
}

// ===== 商品 =====

export class CreateProductDto {
  @IsString() @IsNotEmpty() merchantId!: string;
  @IsString() @IsNotEmpty() categoryId!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() image?: string;
  @Type(() => Number) @IsInt() @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() onSale?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) specGroupIds?: string[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @IsNotEmpty() categoryId?: string;
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() onSale?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) specGroupIds?: string[];
}

export class UpdateStockDto {
  @Type(() => Number) @IsInt() @Min(0) stock!: number;
}

export class UpdateSaleDto {
  @Type(() => Boolean) @IsBoolean() onSale!: boolean;
}

// ===== 规格组 =====

export class SpecOptionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @Type(() => Number) @IsInt() priceDelta?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}

export class CreateSpecGroupDto {
  @IsString() @IsNotEmpty() merchantId!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsIn(['single', 'multi']) type!: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() required?: boolean;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => SpecOptionDto) options!: SpecOptionDto[];
}

export class UpdateSpecGroupDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsIn(['single', 'multi']) type?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SpecOptionDto) options?: SpecOptionDto[];
}
