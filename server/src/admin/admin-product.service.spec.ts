import { AdminProductService } from './admin-product.service';
import { BizException } from '../common/biz-exception';

describe('AdminProductService', () => {
  const mockProduct = {
    id: 'p001',
    merchantId: 'm001',
    categoryId: 'c001',
    name: '珍珠奶茶',
    description: '经典珍珠奶茶',
    image: null,
    price: 1500,
    stock: 50,
    onSale: true,
    specGroups: [{ specGroup: { id: 'g001' } }],
  };

  let service: AdminProductService;
  let prismaMock: any;
  let menuServiceMock: any;
  let productServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      merchant: { findUnique: jest.fn().mockResolvedValue({ id: 'm001' }) },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'c001', merchantId: 'm001' }) },
      specGroup: { findMany: jest.fn() },
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productSpecGroup: { deleteMany: jest.fn() },
      $transaction: jest.fn((cb: any) => cb({
        productSpecGroup: prismaMock.productSpecGroup,
        product: prismaMock.product,
      })),
    };
    menuServiceMock = { invalidateMenu: jest.fn().mockResolvedValue(undefined) };
    productServiceMock = { invalidate: jest.fn().mockResolvedValue(undefined) };
    service = new AdminProductService(prismaMock, menuServiceMock, productServiceMock);
  });

  describe('list', () => {
    it('should return products with specGroupIds', async () => {
      prismaMock.product.findMany.mockResolvedValue([mockProduct]);
      const result = await service.list('m001');
      expect(result).toEqual([
        {
          id: 'p001',
          merchantId: 'm001',
          categoryId: 'c001',
          name: '珍珠奶茶',
          description: '经典珍珠奶茶',
          image: null,
          price: 1500,
          stock: 50,
          onSale: true,
          specGroupIds: ['g001'],
        },
      ]);
    });

    it('should throw BizException(1004) when merchant not found', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);
      await expect(service.list('m999')).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('create', () => {
    it('should create product with spec group links and invalidate caches', async () => {
      prismaMock.specGroup.findMany.mockResolvedValue([{ id: 'g001' }]);
      prismaMock.product.create.mockResolvedValue(mockProduct);
      const result = await service.create({
        merchantId: 'm001',
        categoryId: 'c001',
        name: '珍珠奶茶',
        price: 1500,
        specGroupIds: ['g001'],
      });
      expect(result.specGroupIds).toEqual(['g001']);
      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'm001',
            categoryId: 'c001',
            name: '珍珠奶茶',
            price: 1500,
            stock: 0,
            onSale: true,
            specGroups: { create: [{ id: expect.any(String), specGroupId: 'g001', sort: 0 }] },
          }),
        }),
      );
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
      expect(productServiceMock.invalidate).toHaveBeenCalledWith('p001');
    });

    it('should throw BizException(1004) when category belongs to another merchant', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c001', merchantId: 'm002' });
      await expect(
        service.create({ merchantId: 'm001', categoryId: 'c001', name: 'x', price: 100 }),
      ).rejects.toBeInstanceOf(BizException);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('should throw BizException(1004) when spec group not found', async () => {
      prismaMock.specGroup.findMany.mockResolvedValue([]);
      try {
        await service.create({
          merchantId: 'm001',
          categoryId: 'c001',
          name: 'x',
          price: 100,
          specGroupIds: ['g999'],
        });
        throw new Error('should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BizException);
        expect(e.getCode()).toBe(1004);
      }
    });
  });

  describe('update', () => {
    it('should update provided fields only without touching spec groups', async () => {
      prismaMock.product.findUnique.mockResolvedValue(mockProduct);
      prismaMock.product.update.mockResolvedValue({ ...mockProduct, price: 1800 });
      const result = await service.update('p001', { price: 1800 });
      expect(result.price).toBe(1800);
      expect(prismaMock.productSpecGroup.deleteMany).not.toHaveBeenCalled();
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
      expect(productServiceMock.invalidate).toHaveBeenCalledWith('p001');
    });

    it('should replace spec groups when specGroupIds provided', async () => {
      prismaMock.product.findUnique.mockResolvedValue(mockProduct);
      prismaMock.specGroup.findMany.mockResolvedValue([{ id: 'g002' }]);
      prismaMock.product.update.mockResolvedValue({
        ...mockProduct,
        specGroups: [{ specGroup: { id: 'g002' } }],
      });
      const result = await service.update('p001', { specGroupIds: ['g002'] });
      expect(prismaMock.productSpecGroup.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p001' } });
      expect(result.specGroupIds).toEqual(['g002']);
    });

    it('should throw BizException(1004) when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.update('unknown', { name: 'x' })).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('updateStock', () => {
    it('should update stock and invalidate caches', async () => {
      prismaMock.product.findUnique.mockResolvedValue(mockProduct);
      prismaMock.product.update.mockResolvedValue({ ...mockProduct, stock: 100 });
      const result = await service.updateStock('p001', 100);
      expect(result.stock).toBe(100);
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'p001' },
        data: { stock: 100 },
      });
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
      expect(productServiceMock.invalidate).toHaveBeenCalledWith('p001');
    });

    it('should throw BizException(1004) when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.updateStock('unknown', 10)).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('updateSale', () => {
    it('should update onSale and invalidate caches', async () => {
      prismaMock.product.findUnique.mockResolvedValue(mockProduct);
      prismaMock.product.update.mockResolvedValue({ ...mockProduct, onSale: false });
      const result = await service.updateSale('p001', false);
      expect(result.onSale).toBe(false);
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
    });
  });

  describe('remove', () => {
    it('should delete product and invalidate caches', async () => {
      prismaMock.product.findUnique.mockResolvedValue(mockProduct);
      const result = await service.remove('p001');
      expect(result).toEqual({ id: 'p001' });
      expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p001' } });
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
      expect(productServiceMock.invalidate).toHaveBeenCalledWith('p001');
    });

    it('should throw BizException(1004) when product not found', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.remove('unknown')).rejects.toBeInstanceOf(BizException);
    });
  });
});
