import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { BizException } from '../common/biz-exception';

const JWT_SECRET = 'unit_test_secret_key';

const mockPrisma = {
  adminUser: { findUnique: jest.fn() },
};

/** 断言 BizException 的业务码（沿用项目 getCode() 约定） */
async function expectBizCode(promise: Promise<unknown>, code: number): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(BizException);
  try {
    await promise;
  } catch (e: any) {
    expect(e.getCode()).toBe(code);
  }
}

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } })],
      providers: [AuthService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
    mockPrisma.adminUser.findUnique.mockReset();
  });

  describe('adminLogin', () => {
    it('issues a token carrying the admin principal when password matches', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'au_1',
        merchantId: 'm001',
        username: 'admin',
        role: 'owner',
        password: await hash('admin123', 10),
      });

      const result = await service.adminLogin('admin', 'admin123');

      expect(result.merchantId).toBe('m001');
      expect(result.role).toBe('owner');
      expect(result.username).toBe('admin');
      expect(jwt.verify(result.token)).toMatchObject({
        adminId: 'au_1',
        merchantId: 'm001',
        role: 'owner',
      });
      expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { username: 'admin' } });
    });

    it('rejects with code 1002 when the password is wrong', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'au_1',
        merchantId: 'm001',
        username: 'admin',
        role: 'owner',
        password: await hash('admin123', 10),
      });

      await expectBizCode(service.adminLogin('admin', 'wrong-pass'), 1002);
    });

    it('rejects with the same message when the user does not exist', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      const promise = service.adminLogin('ghost', 'whatever');
      await expectBizCode(promise, 1002);
      await expect(promise).rejects.toThrowError('用户名或密码错误');
    });
  });
});
