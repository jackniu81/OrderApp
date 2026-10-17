import { Injectable, Logger, Inject, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BizException } from '../common/biz-exception';
import { Prisma } from '@prisma/client';
import { PrinterDriver, PRINTER_DRIVER } from './printer-driver';

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/**
 * 小票打印服务（specs/03-api.md §8.3）
 */
@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRINTER_DRIVER) private readonly driver: PrinterDriver,
  ) {}

  /**
   * 打印订单小票
   * - 订单不存在 → 1004
   * - 未配置打印机或打印机离线 → 4001
   */
  async printOrder(orderId: string): Promise<{ printId: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new BizException(1004, '订单不存在', HttpStatus.OK);

    const printer = await this.prisma.printer.findFirst({
      where: { merchantId: order.merchantId },
      orderBy: { createdAt: 'asc' },
    });
    if (!printer) {
      throw new BizException(4001, '打印机离线', HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (!(await this.driver.isOnline(printer))) {
      throw new BizException(4001, '打印机离线', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const content = this.formatTicket(order);
    const printId = await this.driver.submit(printer, content);

    this.logger.log(`小票打印: orderId=${orderId}, printer=${printer.id}, printId=${printId}`);
    return { printId };
  }

  /**
   * 小票内容（纯文本，逐行打印）
   */
  private formatTicket(order: OrderWithItems): string {
    const lines: string[] = [];
    lines.push(`订单号: ${order.outTradeNo}`);
    lines.push(`下单时间: ${order.createdAt.toISOString()}`);
    lines.push('--------------------------------');
    for (const item of order.items) {
      lines.push(`${item.productName} x${item.quantity}  ${item.price}分`);
      if (item.specSnapshot) lines.push(`  规格: ${item.specSnapshot}`);
      if (item.remark) lines.push(`  备注: ${item.remark}`);
    }
    lines.push('--------------------------------');
    lines.push(`合计: ${order.totalAmount}分`);
    lines.push(`支付方式: ${order.payMethod}`);
    if (order.remark) lines.push(`订单备注: ${order.remark}`);
    return lines.join('\n');
  }
}
