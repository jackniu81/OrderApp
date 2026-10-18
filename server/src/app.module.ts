import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MerchantModule } from './merchant/merchant.module';
import { MenuModule } from './menu/menu.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { PrintModule } from './print/print.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MerchantModule,
    MenuModule,
    ProductModule,
    OrderModule,
    PaymentModule,
    PrintModule,
    AdminModule,
  ],
})
export class AppModule {}
