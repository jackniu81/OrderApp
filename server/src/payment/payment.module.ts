import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { PrintModule } from '../print/print.module';
import { OrderModule } from '../order/order.module';

@Module({
  // OrderModule 提供应用级 EVENT_BUS，支付成功后向商家端推送新单
  imports: [PrintModule, OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService, RedisService],
  exports: [PaymentService],
})
export class PaymentModule {}
