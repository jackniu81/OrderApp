import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

@Module({
  controllers: [MenuController],
  providers: [MenuService, PrismaService, RedisService],
  exports: [MenuService],
})
export class MenuModule {}
