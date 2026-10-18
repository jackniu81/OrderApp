import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { BizException } from '../common/biz-exception';

/**
 * 分类管理（商家端）
 * specs/03-api.md §5.1
 */
@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
  ) {}

  private genId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `cat${ts}${rand}`.slice(0, 32);
  }

  async list(merchantId: string) {
    await this.assertMerchant(merchantId);
    const categories = await this.prisma.category.findMany({
      where: { merchantId },
      orderBy: { sort: 'asc' },
    });
    return categories.map((c) => this.toDto(c));
  }

  async create(merchantId: string, dto: { name: string; sort?: number; visible?: boolean }) {
    await this.assertMerchant(merchantId);
    const category = await this.prisma.category.create({
      data: {
        id: this.genId(),
        merchantId,
        name: dto.name,
        sort: dto.sort ?? 0,
        visible: dto.visible ?? true,
      },
    });
    await this.refresh(merchantId);
    return this.toDto(category);
  }

  async update(id: string, dto: { name?: string; sort?: number; visible?: boolean }) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new BizException(1004, '分类不存在', HttpStatus.OK);
    }
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sort !== undefined ? { sort: dto.sort } : {}),
        ...(dto.visible !== undefined ? { visible: dto.visible } : {}),
      },
    });
    await this.refresh(category.merchantId);
    return this.toDto(category);
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      throw new BizException(1004, '分类不存在', HttpStatus.OK);
    }
    if (existing._count.products > 0) {
      throw new BizException(1001, `分类下还有 ${existing._count.products} 个商品，请先删除或移动商品`, HttpStatus.OK);
    }
    await this.prisma.category.delete({ where: { id } });
    await this.refresh(existing.merchantId);
    return { id };
  }

  private toDto(c: { id: string; merchantId: string; name: string; sort: number; visible: boolean }) {
    return { id: c.id, merchantId: c.merchantId, name: c.name, sort: c.sort, visible: c.visible };
  }

  private async assertMerchant(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new BizException(1004, '门店不存在', HttpStatus.OK);
    }
  }

  private async refresh(merchantId: string) {
    await this.menuService.invalidateMenu(merchantId);
  }
}
