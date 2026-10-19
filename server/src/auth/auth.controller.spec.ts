import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  adminLogin: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
    mockAuthService.adminLogin.mockReset();
  });

  it('wraps the login result in the unified response', async () => {
    mockAuthService.adminLogin.mockResolvedValue({
      token: 'jwt-token',
      merchantId: 'm001',
      role: 'owner',
      username: 'admin',
    });

    const result = await controller.adminLogin({ username: 'admin', password: 'admin123' });

    expect(mockAuthService.adminLogin).toHaveBeenCalledWith('admin', 'admin123');
    expect(result).toEqual({
      code: 0,
      message: 'ok',
      data: { token: 'jwt-token', merchantId: 'm001', role: 'owner', username: 'admin' },
    });
  });
});
