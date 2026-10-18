import { CategoryService } from './category.service';
import { BizException } from '../common/biz-exception';

describe('CategoryService', () => {
  const mockCategory = {
    id: 'c001',
    merchantId: 'm001',
    name: '招牌奶茶',
    sort: 1,
    visible: true,
  };

  let service: CategoryService;
  let prismaMock: any;
  let menuServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      merchant: { findUnique: jest.fn().mockResolvedValue({ id: 'm001' }) },
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    menuServiceMock = { invalidateMenu: jest.fn().mockResolvedValue(undefined) };
    service = new CategoryService(prismaMock, menuServiceMock);
  });

  describe('list', () => {
    it('should return categories ordered by sort', async () => {
      prismaMock.category.findMany.mockResolvedValue([mockCategory]);
      const result = await service.list('m001');
      expect(result).toEqual([mockCategory]);
      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'm001' },
        orderBy: { sort: 'asc' },
      });
    });

    it('should throw BizException(1004) when merchant not found', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);
      await expect(service.list('m999')).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('create', () => {
    it('should create category with defaults and invalidate menu cache', async () => {
      prismaMock.category.create.mockResolvedValue(mockCategory);
      const result = await service.create('m001', { name: '招牌奶茶', sort: 1 });
      expect(result).toEqual(mockCategory);
      expect(prismaMock.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'm001',
            name: '招牌奶茶',
            sort: 1,
            visible: true,
          }),
        }),
      );
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
    });

    it('should throw BizException(1004) when merchant not found', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);
      await expect(service.create('m999', { name: 'x' })).rejects.toBeInstanceOf(BizException);
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update provided fields only and invalidate cache', async () => {
      prismaMock.category.findUnique.mockResolvedValue(mockCategory);
      prismaMock.category.update.mockResolvedValue({ ...mockCategory, visible: false });
      const result = await service.update('c001', { visible: false });
      expect(result.visible).toBe(false);
      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: 'c001' },
        data: { visible: false },
      });
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
    });

    it('should throw BizException(1004) when category not found', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      await expect(service.update('unknown', { name: 'x' })).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('remove', () => {
    it('should delete category and invalidate cache when no products', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ ...mockCategory, _count: { products: 0 } });
      const result = await service.remove('c001');
      expect(result).toEqual({ id: 'c001' });
      expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: 'c001' } });
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
    });

    it('should throw BizException(1001) when category still has products', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ ...mockCategory, _count: { products: 3 } });
      try {
        await expect(service.remove('c001')).rejects.toBeInstanceOf(BizException);
      } catch (e: any) {
        expect(e.getCode()).toBe(1001);
      }
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });

    it('should throw BizException(1004) when category not found', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);
      await expect(service.remove('unknown')).rejects.toBeInstanceOf(BizException);
    });
  });
});
