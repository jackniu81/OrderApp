import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService, AdminLoginResult } from './auth.service';

class AdminLoginDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() password!: string;
}

interface ApiResponse<T> { code: number; message: string; data: T; }

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/v1/auth/admin-login 商家后台登录 */
  @Post('admin-login')
  @HttpCode(200)
  async adminLogin(@Body() dto: AdminLoginDto): Promise<ApiResponse<AdminLoginResult>> {
    const data = await this.authService.adminLogin(dto.username, dto.password);
    return { code: 0, message: 'ok', data };
  }
}
