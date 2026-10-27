import { ProductService } from './product.service';
import { BizException } from '../common/biz-exception';

describe('ProductService', () => {
  let service: ProductService;
  let prismaMock: any;
  let redisMock: any;

  const mockProduct = {
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
      {
        sort: 1,
        specGroup: {
          id: 'g1',
          name: '杯型',
          type: 'single',
          required: true,
          options: [
            { id: 'o1', name: '中杯', priceDelta: 0, sort: 1 },
            { id: 'o2', name: '大杯', priceDelta: 300, sort: 2 },
          ],
        },
      },
      {
        sort: 2,
        specGroup: {
          id: 'g2',
          name: '加料',
          type: 'multi',
          required: false,
          options: [{ id: 'o3', name: '珍珠', priceDelta: 200, sort: 1 }],
        },
      },
    ],
  };

  beforeEach(() => {
    prismaMock = { product: { findUnique: jest.fn().mockResolvedValue(mockProduct) } };
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new ProductService(prismaMock, redisMock);
  });

  describe('getDetail', () => {
    it('should return product detail with spec groups and options', async () => {
      const detail = await service.getDetail('p1');

      expect(detail.id).toBe('p1');
      expect(detail.soldOut).toBe(false);
      expect(detail.specGroups).toHaveLength(2);

      const cupGroup = detail.specGroups.find((g: any) => g.id === 'g1');
      expect(cupGroup.type).toBe('single');
      expect(cupGroup.required).toBe(true);
      expect(cupGroup.options).toHaveLength(2);
      expect(cupGroup.options[1].priceDelta).toBe(300); // 大杯加价 300

      // 加料可多选
      const toppingGroup = detail.specGroups.find((g: any) => g.id === 'g2');
      expect(toppingGroup.type).toBe('multi');
    });

    it('should return soldOut=true when stock is 0', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 0 });
      const detail = await service.getDetail('p1');
      expect(detail.soldOut).toBe(true);
    });

    it('should throw BizException(1004) when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.getDetail('unknown')).rejects.toBeInstanceOf(BizException);
      try {
        await service.getDetail('unknown');
      } catch (e: any) {
        expect(e.getCode()).toBe(1004);
      }
    });

    it('should return cached detail when hit', async () => {
      const cached = { id: 'p1', name: 'cached' };
      redisMock.get.mockResolvedValue(cached);

      const detail = await service.getDetail('p1');
      expect(detail).toEqual(cached);
      expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should delete product cache', async () => {
      await service.invalidate('p1');
      expect(redisMock.del).toHaveBeenCalledWith('product:p1');
    });
  });

  describe('listPresetImages', () => {
    it('should return an array of server-served static paths', () => {
      const list = service.listPresetImages();
      expect(Array.isArray(list)).toBe(true);
      // 静态图托管在 api/v1 前缀下，与 product.image 存值保持一致
      list.forEach((p) => expect(p).toMatch(/^\/api\/v1\/static\/products\/.+\.(png|jpe?g|gif|webp)$/i));
    });

    it('should include the committed seed presets', () => {
      const list = service.listPresetImages();
      expect(list).toContain('/api/v1/static/products/milk-tea.png');
      expect(list).toContain('/api/v1/static/products/fries.png');
    });

    it('should return sorted paths', () => {
      const list = service.listPresetImages();
      expect(list).toEqual([...list].sort());
    });
  });
});
