import { Test, TestingModule } from '@nestjs/testing';
import { MerchantController } from './merchant.controller';
import { MerchantService, SceneCodec } from './merchant.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMerchantService = {
  resolveByScene: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  toPublicDto: jest.fn(),
};

describe('MerchantController', () => {
  let controller: MerchantController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantController],
      providers: [
        { provide: MerchantService, useValue: mockMerchantService },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<MerchantController>(MerchantController);
    jest.clearAllMocks();
  });

  describe('GET /resolve', () => {
    it('should return wrapped response', async () => {
      const scene = SceneCodec.encode('m001');
      mockMerchantService.resolveByScene.mockResolvedValue({
        merchantId: 'm001',
        merchantName: '示例奶茶店',
        logo: null,
        isOpen: true,
        notice: null,
      });

      const result = await controller.resolve({ scene });

      expect(result).toEqual({
        code: 0,
        message: 'ok',
        data: {
          merchantId: 'm001',
          merchantName: '示例奶茶店',
          logo: null,
          isOpen: true,
          notice: null,
        },
      });
      expect(mockMerchantService.resolveByScene).toHaveBeenCalledWith(scene);
    });
  });

  describe('GET /:id', () => {
    it('should return wrapped merchant', async () => {
      const raw = { id: 'm001', name: '示例奶茶店' } as any;
      mockMerchantService.findById.mockResolvedValue(raw);
      mockMerchantService.toPublicDto.mockReturnValue({ id: 'm001', name: '示例奶茶店' });

      const result = await controller.getById({ id: 'm001' });

      expect(result.code).toBe(0);
      expect(result.data).toEqual({ id: 'm001', name: '示例奶茶店' });
    });
  });

  describe('PUT /:id', () => {
    it('should update and return wrapped merchant', async () => {
      const raw = { id: 'm001', name: '新奶茶店' } as any;
      mockMerchantService.update.mockResolvedValue(raw);
      mockMerchantService.toPublicDto.mockReturnValue({ id: 'm001', name: '新奶茶店' });

      const result = await controller.update({ id: 'm001' }, { name: '新奶茶店' });

      expect(result.code).toBe(0);
      expect(mockMerchantService.update).toHaveBeenCalledWith('m001', { name: '新奶茶店' });
    });
  });
});
