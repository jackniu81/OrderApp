import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MerchantController } from './merchant.controller';
import { MerchantService, SceneCodec } from './merchant.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMerchantService = {
  resolveByScene: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  toPublicDto: jest.fn(),
};

/** Guard 校验后的请求对象（单测不经过 HTTP 层，直接构造） */
const adminReq = (merchantId: string) => ({ admin: { merchantId } }) as any;

describe('MerchantController', () => {
  let controller: MerchantController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantController],
      providers: [
        { provide: MerchantService, useValue: mockMerchantService },
        { provide: PrismaService, useValue: {} },
        // @UseGuards(AdminAuthGuard) 会被实例化，但控制器单测不经过 HTTP 层， stub 依赖即可
        { provide: JwtService, useValue: {} },
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

      const result = await controller.update({ id: 'm001' }, { name: '新奶茶店' }, adminReq('m001'));

      expect(result.code).toBe(0);
      expect(mockMerchantService.update).toHaveBeenCalledWith('m001', { name: '新奶茶店' });
    });

    it('更新其他门店设置抛 1003', async () => {
      await expect(controller.update({ id: 'm002' }, { name: '别人的店' }, adminReq('m001'))).rejects.toMatchObject({
        response: { code: 1003 },
      });
      expect(mockMerchantService.update).not.toHaveBeenCalled();
    });
  });
});
