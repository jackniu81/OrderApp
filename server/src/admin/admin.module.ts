import { Module } from '@nestjs/common';
import { AdminCategoryController } from './admin-category.controller';
import { AdminProductController } from './admin-product.controller';
import { AdminSpecGroupController } from './admin-spec-group.controller';
import { CategoryService } from './category.service';
import { AdminProductService } from './admin-product.service';
import { SpecGroupService } from './spec-group.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuModule } from '../menu/menu.module';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [MenuModule, ProductModule],
  controllers: [AdminCategoryController, AdminProductController, AdminSpecGroupController],
  providers: [CategoryService, AdminProductService, SpecGroupService, PrismaService],
})
export class AdminModule {}
