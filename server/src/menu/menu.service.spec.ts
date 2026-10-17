import { MenuService } from './menu.service';
import { BizException } from '../common/biz-exception';

describe('MenuService', () => {
  let service: MenuService;
  let prismaMock: any;
  let redisMock: any;

  const mockCategories = [
    { id: 'c1', merchantId: 'm001', name: '招牌奶茶', sort: 1, visible: true },
    { id: 'c2', merchantId: 'm001', name: '鲜果茶', sort: 2, visible: true },
  ];

  const mockProducts = [
    {
      id: 'p1',
      merchantId: 'm001',
      categoryId: 'c1',
      name: '珍珠奶茶',
      description: '经典招牌',
      image: 'https://cdn.example.com/p1.png',
      price: 1500,
      stock: 50,
      onSale: true,
      specGroups: [
        { sort: 1, specGroup: { id: 'g1', name: '杯型', type: 'single', required: true } },
      ],
    },
    {
      id: 'p2',
      merchantId: 'm001',
      categoryId: 'c1',
      name: '黄金薯条',
      description: '售罄测试',
      image: null,
      price: 1200,
      stock: 0,
      onSale: true,
      specGroups: [],
    },
    {
      id: 'p3',
      merchantId: 'm001',
      categoryId: 'c2',
      name: '芒果青茶',
      description: '新鲜',
      image: null,
      price: 1600,
      stock: 30,
      onSale: true,
      specGroups: [],
    },
  ];

  beforeEach(() => {
    prismaMock = {
      category: { findMany: jest.fn().mockResolvedValue(mockCategories) },
      product: { findMany: jest.fn().mockResolvedValue(mockProducts) },
    };
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new MenuService(prismaMock, redisMock);
  });

  describe('getMenu', () => {
    it('should return aggregated menu with categories and products', async () => {
      const menu = await service.getMenu('m001');

      expect(menu.categories).toHaveLength(2);
      expect(menu.categories[0].name).toBe('招牌奶茶');
      expect(menu.categories[0].products).toHaveLength(2);

      // 售罄商品标记
      const fries = menu.categories[0].products.find((p: any) => p.id === 'p2');
      expect(fries.soldOut).toBe(true);

      // 规格组引用
      const pearl = menu.categories[0].products.find((p: any) => p.id === 'p1');
      expect(pearl.specGroupIds).toEqual(['g1']);

      // 缓存写入
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should return cached menu when hit', async () => {
      const cached = { categories: [{ id: 'c1', name: 'cache' }] };
      redisMock.get.mockResolvedValue(cached);

      const menu = await service.getMenu('m001');

      expect(menu).toEqual(cached);
      expect(prismaMock.category.findMany).not.toHaveBeenCalled();
      expect(prismaMock.product.findMany).not.toHaveBeenCalled();
    });

    it('should skip redis write when redis unavailable', async () => {
      redisMock.set.mockRejectedValue(new Error('redis down'));

      // 不抛异常，正常返回 menu
      const menu = await service.getMenu('m001');
      expect(menu.categories.length).toBeGreaterThan(0);
    });
  });

  describe('invalidateMenu', () => {
    it('should delete cache key', async () => {
      await service.invalidateMenu('m001');
      expect(redisMock.del).toHaveBeenCalledWith('menu:m001');
    });
  });
});
