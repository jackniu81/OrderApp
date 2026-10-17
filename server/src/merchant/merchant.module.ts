import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService, PrismaService],
  exports: [MerchantService],
})
export class MerchantModule {}
