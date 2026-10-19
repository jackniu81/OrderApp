import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { BizException } from '../common/biz-exception';

/** JWT payload，登录时签发 */
export interface AdminPrincipal {
  adminId: string;
  merchantId: string;
  role: string;
  username: string;
}

/**
 * 商家端鉴权 Guard（specs/03-api.md §1.4：Authorization: Bearer <admin_token>）
 * 校验通过后把 principal 挂到 req.admin；请求中显式携带的 merchantId 必须属于 token 门店
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { admin?: AdminPrincipal; query?: Record<string, unknown>; body?: unknown }
    >();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) {
      throw new BizException(1002, '未登录或 token 失效', HttpStatus.UNAUTHORIZED);
    }

    try {
      request.admin = await this.jwt.verifyAsync<AdminPrincipal>(token);
    } catch {
      throw new BizException(1002, '未登录或 token 失效', HttpStatus.UNAUTHORIZED);
    }

    this.assertMerchantScope(request);
    return true;
  }

  /** 单店模板下请求仍可携带 merchantId（接口契约如此），跨门店访问一律 1003 */
  private assertMerchantScope(request: Request & { admin?: AdminPrincipal }): void {
    const merchantId = request.admin!.merchantId;
    const requested = [request.query?.merchantId, (request.body as { merchantId?: unknown } | undefined)?.merchantId];
    if (requested.some((value) => value !== undefined && value !== merchantId)) {
      throw new BizException(1003, '无权访问其他门店', HttpStatus.FORBIDDEN);
    }
  }
}
