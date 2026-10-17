import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MerchantModule } from './merchant/merchant.module';
import { MenuModule } from './menu/menu.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MerchantModule,
    MenuModule,
    ProductModule,
  ],
})
export class AppModule {}
