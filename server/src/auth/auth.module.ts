import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const JWT_SECRET_PLACEHOLDER = 'replace_with_a_random_secret_key_at_least_32_chars';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 未配置，请参考 .env.example 设置后再启动');
  }
  if (secret === JWT_SECRET_PLACEHOLDER) {
    Logger.warn('JWT_SECRET 仍是 .env.example 的占位值，仅可用于本地开发', 'AuthModule');
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: resolveJwtSecret(),
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard, PrismaService],
  exports: [JwtModule, AuthService, AdminAuthGuard],
})
export class AuthModule {}
