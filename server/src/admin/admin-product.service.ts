import { Injectable, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { ProductService } from '../product/product.service';
import { BizException } from '../common/biz-exception';

/**
 * 商品管理（商家端）
 * specs/03-api.md §5.2
 */
@Injectable()
export class AdminProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly productService: ProductService,
  ) {}

  private genId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `prd${ts}${rand}`.slice(0, 32);
  }

  async list(merchantId: string) {
    await this.assertMerchant(merchantId);
    const products = await this.prisma.product.findMany({
      where: { merchantId },
      include: {
        specGroups: {
          include: { specGroup: true },
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => this.toDto(p));
  }

  async create(dto: {
    merchantId: string;
    categoryId: string;
    name: string;
    description?: string;
    image?: string;
    price: number;
    stock?: number;
    onSale?: boolean;
    specGroupIds?: string[];
  }) {
    await this.assertMerchant(dto.merchantId);
    await this.assertCategory(dto.categoryId, dto.merchantId);
    const specGroupIds = await this.assertSpecGroups(dto.specGroupIds ?? [], dto.merchantId);

    const data: Prisma.ProductUncheckedCreateInput = {
      id: this.genId(),
      merchantId: dto.merchantId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description,
      image: dto.image,
      price: dto.price,
      stock: dto.stock ?? 0,
      onSale: dto.onSale ?? true,
      specGroups: {
        create: specGroupIds.map((groupId, i) => ({
          id: this.genId(),
          specGroupId: groupId,
          sort: i,
        })),
      },
    };

    const product = await this.prisma.product.create({
      data,
      include: { specGroups: { include: { specGroup: true } } },
    });

    await this.refresh(product.merchantId, product.id);
    return this.toDto(product);
  }

  async update(
    id: string,
    dto: {
      categoryId?: string;
      name?: string;
      description?: string;
      image?: string;
      price?: number;
      stock?: number;
      onSale?: boolean;
      specGroupIds?: string[];
    },
  ) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new BizException(1004, '商品不存在', HttpStatus.OK);
    }
    if (dto.categoryId !== undefined) {
      await this.assertCategory(dto.categoryId, existing.merchantId);
    }
    const specGroupIds =
      dto.specGroupIds !== undefined
        ? await this.assertSpecGroups(dto.specGroupIds, existing.merchantId)
        : undefined;

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.onSale !== undefined) data.onSale = dto.onSale;
    if (specGroupIds !== undefined) {
      data.specGroups = {
        create: specGroupIds.map((groupId, i) => ({
          id: this.genId(),
          specGroupId: groupId,
          sort: i,
        })),
      };
    }

    const product = await this.prisma.$transaction(async (tx) => {
      if (specGroupIds !== undefined) {
        await tx.productSpecGroup.deleteMany({ where: { productId: id } });
      }
      return tx.product.update({
        where: { id },
        data,
        include: { specGroups: { include: { specGroup: true }, orderBy: { sort: 'asc' } } },
      });
    });

    await this.refresh(product.merchantId, product.id);
    return this.toDto(product);
  }

  async updateStock(id: string, stock: number) {
    const existing = await this.getProduct(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { stock },
    });
    await this.refresh(product.merchantId, product.id);
    return this.toDto(product);
  }

  async updateSale(id: string, onSale: boolean) {
    await this.getProduct(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { onSale },
    });
    await this.refresh(product.merchantId, product.id);
    return this.toDto(product);
  }

  async remove(id: string) {
    const existing = await this.getProduct(id);
    await this.prisma.product.delete({ where: { id } });
    await this.refresh(existing.merchantId, id);
    return { id };
  }

  private async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new BizException(1004, '商品不存在', HttpStatus.OK);
    }
    return product;
  }

  private toDto(p: {
    id: string;
    merchantId: string;
    categoryId: string;
    name: string;
    description: string | null;
    image: string | null;
    price: number;
    stock: number;
    onSale: boolean;
    specGroups?: { specGroup: { id: string } }[];
  }) {
    return {
      id: p.id,
      merchantId: p.merchantId,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      image: p.image,
      price: p.price,
      stock: p.stock,
      onSale: p.onSale,
      specGroupIds: (p.specGroups ?? []).map((sg) => sg.specGroup.id),
    };
  }

  private async assertMerchant(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new BizException(1004, '门店不存在', HttpStatus.OK);
    }
  }

  private async assertCategory(categoryId: string, merchantId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.merchantId !== merchantId) {
      throw new BizException(1004, '分类不存在', HttpStatus.OK);
    }
  }

  private async assertSpecGroups(ids: string[], merchantId: string): Promise<string[]> {
    if (ids.length === 0) return ids;
    const groups = await this.prisma.specGroup.findMany({
      where: { id: { in: ids }, merchantId },
      select: { id: true },
    });
    const found = new Set(groups.map((g) => g.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BizException(1004, `规格组不存在: ${missing.join(', ')}`, HttpStatus.OK);
    }
    return ids;
  }

  private async refresh(merchantId: string, productId: string) {
    await this.menuService.invalidateMenu(merchantId);
    await this.productService.invalidate(productId);
  }
}
