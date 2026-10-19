import { Module } from '@nestjs/common';
import { AdminCategoryController } from './admin-category.controller';
import { AdminProductController } from './admin-product.controller';
import { AdminPrinterController } from './admin-printer.controller';
import { AdminSpecGroupController } from './admin-spec-group.controller';
import { CategoryService } from './category.service';
import { AdminProductService } from './admin-product.service';
import { SpecGroupService } from './spec-group.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { MenuModule } from '../menu/menu.module';
import { PrintModule } from '../print/print.module';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [AuthModule, MenuModule, PrintModule, ProductModule],
  controllers: [AdminCategoryController, AdminProductController, AdminPrinterController, AdminSpecGroupController],
  providers: [CategoryService, AdminProductService, SpecGroupService, PrismaService],
})
export class AdminModule {}
