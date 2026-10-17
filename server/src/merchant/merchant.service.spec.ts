import { SceneCodec, MerchantService } from './merchant.service';
import { BizException } from '../common/biz-exception';
import { HttpStatus } from '@nestjs/common';

// ===== SceneCodec =====
describe('SceneCodec', () => {
  it('should encode merchantId correctly', () => {
    const scene = SceneCodec.encode('m001');
    expect(scene).toBe(Buffer.from('merchant_id=m001').toString('base64'));
  });

  it('should decode valid scene', () => {
    const scene = SceneCodec.encode('m001');
    const decoded = SceneCodec.decode(scene);
    expect(decoded).toEqual({ merchantId: 'm001' });
  });

  it('should return null for invalid base64', () => {
    expect(SceneCodec.decode('not-valid-base64!!!')).toBeNull();
  });

  it('should return null for base64 without merchant_id', () => {
    const garbage = Buffer.from('hello=world').toString('base64');
    expect(SceneCodec.decode(garbage)).toBeNull();
  });
});

// ===== MerchantService =====
describe('MerchantService', () => {
  const mockMerchant = {
    id: 'm001',
    name: '示例奶茶店',
    logo: 'https://cdn.example.com/logo.png',
    address: '示例路 100 号',
    phone: '13800138000',
    businessHours: '09:00-22:00',
    isOpen: true,
    payOnSiteEnabled: true,
    notice: '欢迎光临',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as const;

  let service: MerchantService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      merchant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new MerchantService(prismaMock);
  });

  describe('resolveByScene', () => {
    it('should return merchant info when scene is valid and merchant exists', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(mockMerchant);

      const scene = SceneCodec.encode('m001');
      const result = await service.resolveByScene(scene);

      expect(result).toEqual({
        merchantId: 'm001',
        merchantName: '示例奶茶店',
        logo: 'https://cdn.example.com/logo.png',
        isOpen: true,
        notice: '欢迎光临',
      });
      expect(prismaMock.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: 'm001' },
      });
    });

    it('should return isOpen=false when merchant is closed', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue({
        ...mockMerchant,
        isOpen: false,
      });

      const scene = SceneCodec.encode('m001');
      const result = await service.resolveByScene(scene);

      expect(result.isOpen).toBe(false);
    });

    it('should throw BizException(1004) when scene is invalid', async () => {
      await expect(service.resolveByScene('not-base64!!!')).rejects.toBeInstanceOf(BizException);
      try {
        await service.resolveByScene('not-base64!!!');
      } catch (e: any) {
        expect(e.getCode()).toBe(1004);
      }
    });

    it('should throw BizException(1004) when merchant does not exist', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);

      const scene = SceneCodec.encode('m999');
      await expect(service.resolveByScene(scene)).rejects.toBeInstanceOf(BizException);
      try {
        await service.resolveByScene(scene);
      } catch (e: any) {
        expect(e.getCode()).toBe(1004);
      }
    });
  });

  describe('findById', () => {
    it('should return merchant when exists', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(mockMerchant);
      const result = await service.findById('m001');
      expect(result).toEqual(mockMerchant);
    });

    it('should throw BizException(1004) when not found', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);
      await expect(service.findById('unknown')).rejects.toBeInstanceOf(BizException);
    });
  });

  describe('update', () => {
    it('should update merchant when exists', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(mockMerchant);
      prismaMock.merchant.update.mockResolvedValue({
        ...mockMerchant,
        name: '新奶茶店',
      });

      const result = await service.update('m001', { name: '新奶茶店' });
      expect(result.name).toBe('新奶茶店');
      expect(prismaMock.merchant.update).toHaveBeenCalledWith({
        where: { id: 'm001' },
        data: { name: '新奶茶店' },
      });
    });
  });

  describe('toPublicDto', () => {
    it('should map merchant entity to public DTO', () => {
      const dto = service.toPublicDto(mockMerchant as any);
      expect(dto).toEqual({
        id: 'm001',
        name: '示例奶茶店',
        logo: 'https://cdn.example.com/logo.png',
        address: '示例路 100 号',
        phone: '13800138000',
        businessHours: '09:00-22:00',
        isOpen: true,
        payOnSiteEnabled: true,
        notice: '欢迎光临',
      });
    });
  });
});
