import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthGuard, AdminPrincipal } from './admin-auth.guard';
import { BizException } from '../common/biz-exception';

const JWT_SECRET = 'unit_test_secret_key';
const principal: AdminPrincipal = {
  adminId: 'au_1',
  merchantId: 'm001',
  role: 'owner',
  username: 'admin',
};

function contextWith(headers: Record<string, string>) {
  const request: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('AdminAuthGuard', () => {
  const jwt = new JwtService({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } });
  const guard = new AdminAuthGuard(jwt);

  it('accepts a Bearer token and attaches the principal to the request', async () => {
    const token = await jwt.signAsync(principal);
    const { ctx, request } = contextWith({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.admin).toMatchObject({ adminId: 'au_1', merchantId: 'm001', role: 'owner' });
  });

  it('rejects a request without an Authorization header', async () => {
    const { ctx } = contextWith({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(BizException);
  });

  it('rejects a non-Bearer scheme', async () => {
    const token = await jwt.signAsync(principal);
    const { ctx } = contextWith({ authorization: `Basic ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(BizException);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = new JwtService({ secret: 'another_secret_key' });
    const { ctx } = contextWith({ authorization: `Bearer ${await forged.signAsync(principal)}` });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(BizException);
    try {
      await guard.canActivate(ctx);
    } catch (e: any) {
      expect(e.getCode()).toBe(1002);
      expect(e.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  describe('merchant scope', () => {
    function contextOf(request: Record<string, any>) {
      return {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
    }

    it('allows a request whose merchantId matches the token', async () => {
      const token = await jwt.signAsync(principal);
      const ctx = contextOf({
        headers: { authorization: `Bearer ${token}` },
        query: { merchantId: 'm001' },
        body: { merchantId: 'm001' },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('rejects a query merchantId from another store with 1003', async () => {
      const token = await jwt.signAsync(principal);
      const ctx = contextOf({
        headers: { authorization: `Bearer ${token}` },
        query: { merchantId: 'm002' },
      });
      try {
        await guard.canActivate(ctx);
        throw new Error('should have thrown');
      } catch (e: any) {
        expect(e.getCode()).toBe(1003);
        expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('rejects a body merchantId from another store with 1003', async () => {
      const token = await jwt.signAsync(principal);
      const ctx = contextOf({
        headers: { authorization: `Bearer ${token}` },
        query: {},
        body: { merchantId: 'm002', name: '打印机' },
      });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(BizException);
    });

    it('passes when no merchantId is carried', async () => {
      const token = await jwt.signAsync(principal);
      const ctx = contextOf({ headers: { authorization: `Bearer ${token}` } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });
});
