import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { CACHE_KEYS, CACHE_TTL } from '../common/cache-keys';
import { BizException } from '../common/biz-exception';
import { HttpStatus } from '@nestjs/common';

/**
 * 菜单聚合服务（顾客端只读）
 * GET /api/v1/menu?merchantId=xxx
 *
 * 数据结构见 specs/03-api.md §4.1
 */
@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getMenu(merchantId: string) {
    const cacheKey = CACHE_KEYS.menu(merchantId);

    // 1. 先读缓存
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`菜单缓存命中: ${merchantId}`);
      return cached;
    }

    // 2. 查分类（可见的，按 sort 升序）
    const categories = await this.prisma.category.findMany({
      where: { merchantId, visible: true },
      orderBy: { sort: 'asc' },
    });

    // 3. 查商品
    const categoryIds = categories.map((c) => c.id);
    const products = await this.prisma.product.findMany({
      where: {
        merchantId,
        categoryId: { in: categoryIds },
        onSale: true,
      },
      include: {
        specGroups: {
          include: { specGroup: true },
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: [
        { category: { sort: 'asc' } },
      ],
    });

    // 4. 聚合
    const menu = {
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        sort: cat.sort,
        visible: cat.visible,
        products: products
          .filter((p) => p.categoryId === cat.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            image: p.image,
            price: p.price,
            stock: p.stock,
            soldOut: p.stock <= 0,
            onSale: p.onSale,
            specGroupIds: p.specGroups.map((sg) => sg.specGroup.id),
          })),
      })),
    };

    // 5. 写缓存（异常不阻塞返回）
    try {
      await this.redis.set(cacheKey, menu, CACHE_TTL.menu);
    } catch {
      // Redis 不可用，跳过缓存
    }

    return menu;
  }

  /**
   * 商家写操作后刷新缓存
   */
  async invalidateMenu(merchantId: string): Promise<void> {
    await this.redis.del(CACHE_KEYS.menu(merchantId));
  }
}
