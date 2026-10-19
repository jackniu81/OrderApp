import { Controller, Get, Post, Put, Patch, Delete, Query, Param, Body, HttpCode, UseGuards } from '@nestjs/common';
import { AdminProductService } from './admin-product.service';
import { CreateProductDto, UpdateProductDto, UpdateStockDto, UpdateSaleDto } from './dto/admin-menu.dto';
import { AdminAuthGuard } from '../auth/admin-auth.guard';

interface ApiResponse<T> { code: number; message: string; data: T; }

/**
 * 商品管理（商家端，specs/03-api.md §5.2）
 */
@UseGuards(AdminAuthGuard)
@Controller('admin/products')
export class AdminProductController {
  constructor(private readonly productService: AdminProductService) {}

  /** GET /api/v1/admin/products?merchantId=xxx 商品列表 */
  @Get()
  @HttpCode(200)
  async list(@Query('merchantId') merchantId: string): Promise<ApiResponse<unknown>> {
    const data = await this.productService.list(merchantId);
    return { code: 0, message: 'ok', data };
  }

  /** POST /api/v1/admin/products 新增商品 */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateProductDto): Promise<ApiResponse<unknown>> {
    const data = await this.productService.create(dto);
    return { code: 0, message: 'ok', data };
  }

  /** PUT /api/v1/admin/products/:id 编辑商品（specGroupIds 传入时整体替换） */
  @Put(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto): Promise<ApiResponse<unknown>> {
    const data = await this.productService.update(id, dto);
    return { code: 0, message: 'ok', data };
  }

  /** PATCH /api/v1/admin/products/:id/stock 调整库存 */
  @Patch(':id/stock')
  @HttpCode(200)
  async updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto): Promise<ApiResponse<unknown>> {
    const data = await this.productService.updateStock(id, dto.stock);
    return { code: 0, message: 'ok', data };
  }

  /** PATCH /api/v1/admin/products/:id/sale 上下架 */
  @Patch(':id/sale')
  @HttpCode(200)
  async updateSale(@Param('id') id: string, @Body() dto: UpdateSaleDto): Promise<ApiResponse<unknown>> {
    const data = await this.productService.updateSale(id, dto.onSale);
    return { code: 0, message: 'ok', data };
  }

  /** DELETE /api/v1/admin/products/:id 删除商品 */
  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.productService.remove(id);
    return { code: 0, message: 'ok', data };
  }
}
