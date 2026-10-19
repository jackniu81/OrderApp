import { Controller, Get, Post, Put, Delete, Query, Param, Body, HttpCode, UseGuards } from '@nestjs/common';
import { SpecGroupService } from './spec-group.service';
import { CreateSpecGroupDto, UpdateSpecGroupDto } from './dto/admin-menu.dto';
import { AdminAuthGuard } from '../auth/admin-auth.guard';

interface ApiResponse<T> { code: number; message: string; data: T; }

/**
 * 规格组管理（商家端，specs/03-api.md §5.3）
 */
@UseGuards(AdminAuthGuard)
@Controller('admin/spec-groups')
export class AdminSpecGroupController {
  constructor(private readonly specGroupService: SpecGroupService) {}

  /** GET /api/v1/admin/spec-groups?merchantId=xxx 规格组列表（含选项） */
  @Get()
  @HttpCode(200)
  async list(@Query('merchantId') merchantId: string): Promise<ApiResponse<unknown>> {
    const data = await this.specGroupService.list(merchantId);
    return { code: 0, message: 'ok', data };
  }

  /** POST /api/v1/admin/spec-groups 新增规格组（含选项） */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreateSpecGroupDto): Promise<ApiResponse<unknown>> {
    const { merchantId, ...rest } = dto;
    const data = await this.specGroupService.create(merchantId, rest);
    return { code: 0, message: 'ok', data };
  }

  /** PUT /api/v1/admin/spec-groups/:id 编辑规格组（options 传入时整体替换） */
  @Put(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateSpecGroupDto): Promise<ApiResponse<unknown>> {
    const data = await this.specGroupService.update(id, dto);
    return { code: 0, message: 'ok', data };
  }

  /** DELETE /api/v1/admin/spec-groups/:id 删除规格组（被商品引用时拒绝） */
  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.specGroupService.remove(id);
    return { code: 0, message: 'ok', data };
  }
}
