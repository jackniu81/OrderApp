import { Injectable, Logger } from '@nestjs/common';
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
}
