import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PrismaService, RedisService],
  exports: [OrderService],
})
export class OrderModule {}
