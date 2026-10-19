import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { PrinterService } from '../print/printer.service';
import { AdminAuthGuard, AdminPrincipal } from '../auth/admin-auth.guard';

interface ApiResponse<T> { code: number; message: string; data: T; }

class CreatePrinterDto {
  @IsString() @IsNotEmpty() merchantId!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) name!: string;
  @IsString() @IsIn(['feie', 'xprinter', 'sunmi']) type!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) sn!: string;
}

/**
 * 打印机配置（商家端，specs/03-api.md §8.1-§8.2）
 * merchantId 与 token 的一致性由 AdminAuthGuard 统一校验
 */
@UseGuards(AdminAuthGuard)
@Controller('admin/printers')
export class AdminPrinterController {
  constructor(private readonly printerService: PrinterService) {}

  /** GET /admin/printers?merchantId=xxx */
  @Get()
  @HttpCode(200)
  async list(@Query('merchantId') merchantId: string): Promise<ApiResponse<unknown>> {
    const list = await this.printerService.list(merchantId);
    return { code: 0, message: 'ok', data: { list } };
  }

  /** POST /admin/printers */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: CreatePrinterDto): Promise<ApiResponse<unknown>> {
    const data = await this.printerService.create(dto);
    return { code: 0, message: 'ok', data };
  }

  /** DELETE /admin/printers/:id */
  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Param('id') id: string,
    @Req() req: Request & { admin?: AdminPrincipal },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.printerService.remove(id, req.admin!.merchantId);
    return { code: 0, message: 'ok', data };
  }
}
