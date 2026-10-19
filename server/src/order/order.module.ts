import { Module } from '@nestjs/common';
import { EventEmitter } from 'events';
import { OrderController } from './order.controller';
import { AdminOrderController } from './admin-order.controller';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { WsGateway } from '../common/ws.gateway';
import { PrintModule } from '../print/print.module';
import { AuthModule } from '../auth/auth.module';

// 应用级事件总线（单例 EventEmitter）
const EVENT_BUS = 'EVENT_BUS';

@Module({
  imports: [PrintModule, AuthModule],
  controllers: [OrderController, AdminOrderController],
  providers: [
    OrderService,
    PrismaService,
    RedisService,
    WsGateway,
    { provide: EVENT_BUS, useFactory: () => new EventEmitter() },
  ],
  exports: [OrderService, EVENT_BUS],
})
export class OrderModule {}
