import { Injectable, Logger } from '@nestjs/common';
import { readdirSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { CACHE_KEYS, CACHE_TTL } from '../common/cache-keys';
import { BizException } from '../common/biz-exception';
import { HttpStatus } from '@nestjs/common';

/**
 * 商品详情服务（顾客端只读，含规格组）
 * GET /api/v1/products/:id
 *
 * 数据结构见 specs/03-api.md §4.2
 */
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getDetail(productId: string) {
    const cacheKey = CACHE_KEYS.product(productId);

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        specGroups: {
          include: {
            specGroup: {
              include: { options: { orderBy: { sort: 'asc' } } },
            },
          },
          orderBy: { sort: 'asc' },
        },
      },
    });

    if (!product) {
      throw new BizException(1004, '商品不存在', HttpStatus.OK);
    }

    const detail = {
      id: product.id,
      name: product.name,
      description: product.description,
      image: product.image,
      price: product.price,
      stock: product.stock,
      soldOut: product.stock <= 0,
      onSale: product.onSale,
      categoryId: product.categoryId,
      specGroups: product.specGroups.map((sg) => ({
        id: sg.specGroup.id,
        name: sg.specGroup.name,
        type: sg.specGroup.type,
        required: sg.specGroup.required,
        options: sg.specGroup.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: o.priceDelta,
        })),
      })),
    };

    try {
      await this.redis.set(cacheKey, detail, CACHE_TTL.product);
    } catch {
      // Redis 不可用，跳过
    }

    return detail;
  }

  async invalidate(productId: string): Promise<void> {
    await this.redis.del(CACHE_KEYS.product(productId));
  }

  /**
   * 预设商品图清单（供 admin 商品图片选择器展示）。
   * 扫描 server/static/products 目录，返回服务端静态路径（与 product.image 存值一致）。
   */
  listPresetImages(): string[] {
    // 编译后为 dist/product，源码运行为 src/product，均上溯两级到 server 根
    const dir = join(__dirname, '..', '..', 'static', 'products');
    try {
      return readdirSync(dir)
        .filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f))
        .sort()
        .map((f) => `/api/v1/static/products/${f}`);
    } catch {
      this.logger.warn(`预设图目录不存在或不可读: ${dir}`);
      return [];
    }
  }
}
