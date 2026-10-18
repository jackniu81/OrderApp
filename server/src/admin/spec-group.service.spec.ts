import { SpecGroupService } from './spec-group.service';
import { BizException } from '../common/biz-exception';

describe('SpecGroupService', () => {
  const mockGroup = {
    id: 'g001',
    merchantId: 'm001',
    name: '杯型',
    type: 'single',
    required: true,
    options: [
      { id: 'o001', name: '中杯', priceDelta: 0 },
      { id: 'o002', name: '大杯', priceDelta: 300 },
    ],
  };

  let service: SpecGroupService;
  let prismaMock: any;
  let menuServiceMock: any;
  let productServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      merchant: { findUnique: jest.fn().mockResolvedValue({ id: 'm001' }) },
      specGroup: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      specOption: { deleteMany: jest.fn() },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'p001' }]) },
      $transaction: jest.fn(),
    };
    prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
    menuServiceMock = { invalidateMenu: jest.fn().mockResolvedValue(undefined) };
    productServiceMock = { invalidate: jest.fn().mockResolvedValue(undefined) };
    service = new SpecGroupService(prismaMock, menuServiceMock, productServiceMock);
  });

  describe('list', () => {
    it('should return groups with options', async () => {
      prismaMock.specGroup.findMany.mockResolvedValue([mockGroup]);
      const result = await service.list('m001');
      expect(result).toEqual([mockGroup]);
      expect(prismaMock.specGroup.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'm001' },
        include: { options: { orderBy: { sort: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw BizException(1004) when merchant not found', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);
      await expect(service.list('m999')).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('create', () => {
    it('should create group with options and invalidate menu + product caches', async () => {
      prismaMock.specGroup.create.mockResolvedValue(mockGroup);
      const result = await service.create('m001', {
        name: '杯型',
        type: 'single',
        required: true,
        options: [
          { name: '中杯', priceDelta: 0 },
          { name: '大杯', priceDelta: 300 },
        ],
      });
      expect(result.options).toHaveLength(2);
      expect(prismaMock.specGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'm001',
            name: '杯型',
            type: 'single',
            required: true,
          }),
        }),
      );
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
      expect(productServiceMock.invalidate).toHaveBeenCalledWith('p001');
    });

    it('should throw BizException(1001) when options empty', async () => {
      try {
        await service.create('m001', { name: '杯型', type: 'single', options: [] });
        throw new Error('should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BizException);
        expect(e.getCode()).toBe(1001);
      }
    });

    it('should throw BizException(1001) when type invalid', async () => {
      try {
        await service.create('m001', { name: '杯型', type: 'triple', options: [{ name: 'x' }] });
        throw new Error('should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BizException);
        expect(e.getCode()).toBe(1001);
      }
    });
  });

  describe('update', () => {
    it('should replace options when provided', async () => {
      prismaMock.specGroup.findUnique.mockResolvedValue(mockGroup);
      prismaMock.specGroup.update.mockResolvedValue({
        ...mockGroup,
        options: [{ id: 'o003', name: '超大杯', priceDelta: 500 }],
      });
      const result = await service.update('g001', { options: [{ name: '超大杯', priceDelta: 500 }] });
      expect(prismaMock.specOption.deleteMany).toHaveBeenCalledWith({ where: { groupId: 'g001' } });
      expect(result.options).toEqual([{ id: 'o003', name: '超大杯', priceDelta: 500 }]);
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
      expect(productServiceMock.invalidate).toHaveBeenCalledWith('p001');
    });

    it('should update name only without touching options', async () => {
      prismaMock.specGroup.findUnique.mockResolvedValue(mockGroup);
      prismaMock.specGroup.update.mockResolvedValue({ ...mockGroup, name: '份量' });
      const result = await service.update('g001', { name: '份量' });
      expect(result.name).toBe('份量');
      expect(prismaMock.specOption.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw BizException(1004) when group not found', async () => {
      prismaMock.specGroup.findUnique.mockResolvedValue(null);
      await expect(service.update('unknown', { name: 'x' })).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('remove', () => {
    it('should delete group and invalidate caches when not referenced', async () => {
      prismaMock.specGroup.findUnique.mockResolvedValue({ ...mockGroup, _count: { products: 0 } });
      const result = await service.remove('g001');
      expect(result).toEqual({ id: 'g001' });
      expect(prismaMock.specGroup.delete).toHaveBeenCalledWith({ where: { id: 'g001' } });
      expect(menuServiceMock.invalidateMenu).toHaveBeenCalledWith('m001');
    });

    it('should throw BizException(1001) when group is used by products', async () => {
      prismaMock.specGroup.findUnique.mockResolvedValue({ ...mockGroup, _count: { products: 2 } });
      try {
        await expect(service.remove('g001')).rejects.toBeInstanceOf(BizException);
      } catch (e: any) {
        expect(e.getCode()).toBe(1001);
      }
      expect(prismaMock.specGroup.delete).not.toHaveBeenCalled();
    });
  });
});
