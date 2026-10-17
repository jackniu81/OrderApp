import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, PrismaService, RedisService],
  exports: [ProductService],
})
export class ProductModule {}
