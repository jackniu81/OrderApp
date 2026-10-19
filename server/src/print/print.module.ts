import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrinterService } from './printer.service';
import { SimulatedPrinterDriver } from './simulated-printer.driver';
import { PRINTER_DRIVER } from './printer-driver';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

@Module({
  providers: [
    PrintService,
    PrinterService,
    { provide: PRINTER_DRIVER, useClass: SimulatedPrinterDriver },
    PrismaService,
    RedisService,
  ],
  exports: [PrintService, PrinterService],
})
export class PrintModule {}
