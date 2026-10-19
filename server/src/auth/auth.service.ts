import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { BizException } from '../common/biz-exception';
import { AdminPrincipal } from './admin-auth.guard';

export interface AdminLoginResult {
  token: string;
  merchantId: string;
  role: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * 商家后台登录（specs/03-api.md §2.2）
   * 用户不存在与密码错误返回同一提示，避免账号枚举
   */
  async adminLogin(username: string, password: string): Promise<AdminLoginResult> {
    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    const matched = user ? await compare(password, user.password) : false;
    if (!user || !matched) {
      throw new BizException(1002, '用户名或密码错误', HttpStatus.UNAUTHORIZED);
    }

    const principal: AdminPrincipal = {
      adminId: user.id,
      merchantId: user.merchantId,
      role: user.role,
      username: user.username,
    };
    const token = await this.jwt.signAsync(principal);
    return { token, ...principal };
  }
}
