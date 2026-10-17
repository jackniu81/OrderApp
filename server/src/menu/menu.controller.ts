import { Controller, Get, Query, HttpCode } from '@nestjs/common';
import { MenuService } from './menu.service';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

class GetMenuQueryDto {
  @IsString()
  @IsNotEmpty()
  merchantId!: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * GET /api/v1/menu?merchantId=xxx
   * 获取菜单（含分类 + 商品 + 规格组引用）
   */
  @Get()
  @HttpCode(200)
  async getMenu(@Query() query: GetMenuQueryDto): Promise<ApiResponse<unknown>> {
    const data = await this.menuService.getMenu(query.merchantId);
    return { code: 0, message: 'ok', data };
  }
}
