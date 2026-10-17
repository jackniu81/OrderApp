import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { PrintModule } from '../print/print.module';

@Module({
  imports: [PrintModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService, RedisService],
  exports: [PaymentService],
})
export class PaymentModule {}
