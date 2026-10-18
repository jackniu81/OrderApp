import { Controller, Get, Post, Put, Delete, Query, Param, Body, HttpCode } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/admin-menu.dto';

interface ApiResponse<T> { code: number; message: string; data: T; }

/**
 * 分类管理（商家端，specs/03-api.md §5.1）
 */
@Controller('admin/categories')
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /** GET /api/v1/admin/categories?merchantId=xxx 分类列表 */
  @Get()
  @HttpCode(200)
  async list(@Query('merchantId') merchantId: string): Promise<ApiResponse<unknown>> {
    const data = await this.categoryService.list(merchantId);
    return { code: 0, message: 'ok', data };
  }

  /** POST /api/v1/admin/categories 新增分类 */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateCategoryDto): Promise<ApiResponse<unknown>> {
    const { merchantId, ...rest } = dto;
    const data = await this.categoryService.create(merchantId, rest);
    return { code: 0, message: 'ok', data };
  }

  /** PUT /api/v1/admin/categories/:id 编辑分类 */
  @Put(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<ApiResponse<unknown>> {
    const data = await this.categoryService.update(id, dto);
    return { code: 0, message: 'ok', data };
  }

  /** DELETE /api/v1/admin/categories/:id 删除分类（分类下有商品时拒绝） */
  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.categoryService.remove(id);
    return { code: 0, message: 'ok', data };
  }
}
