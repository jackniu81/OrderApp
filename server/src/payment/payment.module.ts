import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService, RedisService],
  exports: [PaymentService],
})
export class PaymentModule {}
