import { Controller, Get, Param, HttpCode } from '@nestjs/common';
import { ProductService } from './product.service';
import { IsNotEmpty, IsString } from 'class-validator';

class GetProductParamDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * GET /api/v1/products/:id
   * 商品详情（含规格组 + 选项）
   */
  @Get(':id')
  @HttpCode(200)
  async getDetail(@Param() param: GetProductParamDto): Promise<ApiResponse<unknown>> {
    const data = await this.productService.getDetail(param.id);
    return { code: 0, message: 'ok', data };
  }
}
