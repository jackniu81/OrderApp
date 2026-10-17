import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MerchantModule } from './merchant/merchant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MerchantModule,
  ],
})
export class AppModule {}
