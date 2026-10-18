import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { ProductService } from '../product/product.service';
import { BizException } from '../common/biz-exception';

export interface SpecOptionDto {
  id?: string;
  name: string;
  priceDelta?: number;
  sort?: number;
}

/**
 * 规格组管理（商家端）
 * specs/03-api.md §5.3
 */
@Injectable()
export class SpecGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly productService: ProductService,
  ) {}

  private genId(prefix: string): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}${ts}${rand}`.slice(0, 32);
  }

  async list(merchantId: string) {
    await this.assertMerchant(merchantId);
    const groups = await this.prisma.specGroup.findMany({
      where: { merchantId },
      include: { options: { orderBy: { sort: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return groups.map((g) => this.toDto(g));
  }

  async create(
    merchantId: string,
    dto: { name: string; type: string; required?: boolean; options: SpecOptionDto[] },
  ) {
    await this.assertMerchant(merchantId);
    this.assertOptions(dto.options);
    const type = this.assertType(dto.type);

    const group = await this.prisma.specGroup.create({
      data: {
        id: this.genId('g'),
        merchantId,
        name: dto.name,
        type,
        required: dto.required ?? false,
        options: {
          create: dto.options.map((o, i) => ({
            id: this.genId('o'),
            name: o.name,
            priceDelta: o.priceDelta ?? 0,
            sort: o.sort ?? i,
          })),
        },
      },
      include: { options: { orderBy: { sort: 'asc' } } },
    });

    await this.refresh(merchantId);
    return this.toDto(group);
  }

  async update(
    id: string,
    dto: { name?: string; type?: string; required?: boolean; options?: SpecOptionDto[] },
  ) {
    const existing = await this.prisma.specGroup.findUnique({ where: { id } });
    if (!existing) {
      throw new BizException(1004, '规格组不存在', HttpStatus.OK);
    }
    if (dto.options !== undefined) this.assertOptions(dto.options);
    const type = dto.type !== undefined ? this.assertType(dto.type) : undefined;

    // 选项整体替换（与商品编辑 specGroupIds 同思路）
    const group = await this.prisma.$transaction(async (tx) => {
      if (dto.options !== undefined) {
        await tx.specOption.deleteMany({ where: { groupId: id } });
      }
      return tx.specGroup.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(dto.required !== undefined ? { required: dto.required } : {}),
          ...(dto.options !== undefined
            ? {
                options: {
                  create: dto.options.map((o, i) => ({
                    id: this.genId('o'),
                    name: o.name,
                    priceDelta: o.priceDelta ?? 0,
                    sort: o.sort ?? i,
                  })),
                },
              }
            : {}),
        },
        include: { options: { orderBy: { sort: 'asc' } } },
      });
    });

    await this.refresh(group.merchantId);
    return this.toDto(group);
  }

  async remove(id: string) {
    const existing = await this.prisma.specGroup.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      throw new BizException(1004, '规格组不存在', HttpStatus.OK);
    }
    if (existing._count.products > 0) {
      throw new BizException(1001, `规格组已被 ${existing._count.products} 个商品使用，请先解除关联`, HttpStatus.OK);
    }
    await this.prisma.specGroup.delete({ where: { id } });
    await this.refresh(existing.merchantId);
    return { id };
  }

  private toDto(g: {
    id: string;
    merchantId: string;
    name: string;
    type: string;
    required: boolean;
    options: { id: string; name: string; priceDelta: number }[];
  }) {
    return {
      id: g.id,
      merchantId: g.merchantId,
      name: g.name,
      type: g.type,
      required: g.required,
      options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
    };
  }

  private assertOptions(options: SpecOptionDto[]) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new BizException(1001, '规格选项不能为空', HttpStatus.OK);
    }
  }

  private assertType(type: string): 'single' | 'multi' {
    if (type !== 'single' && type !== 'multi') {
      throw new BizException(1001, 'type 只能为 single 或 multi', HttpStatus.OK);
    }
    return type;
  }

  private async assertMerchant(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new BizException(1004, '门店不存在', HttpStatus.OK);
    }
  }

  private async refresh(merchantId: string) {
    await this.menuService.invalidateMenu(merchantId);
    // 规格价格影响商品详情缓存
    const products = await this.prisma.product.findMany({
      where: { merchantId },
      select: { id: true },
    });
    for (const p of products) {
      await this.productService.invalidate(p.id);
    }
  }
}
