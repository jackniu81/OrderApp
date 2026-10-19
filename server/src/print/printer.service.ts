import { Inject, Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BizException } from '../common/biz-exception';
import { PRINTER_DRIVER, PrinterDriver } from './printer-driver';

/** 厂商类型（specs/02-domain.md §1.9） */
const PRINTER_TYPES = ['feie', 'xprinter', 'sunmi'];

export interface PrinterInput {
  merchantId: string;
  name: string;
  type: string;
  sn: string;
}

/**
 * 打印机配置管理（specs/03-api.md §8.1-§8.2）
 */
@Injectable()
export class PrinterService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRINTER_DRIVER) private readonly driver: PrinterDriver,
  ) {}

  /** 打印机列表（含驱动实时在线状态） */
  async list(merchantId: string) {
    const printers = await this.prisma.printer.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
    });
    const onlineFlags = await Promise.all(printers.map((p) => this.driver.isOnline(p)));
    return printers.map((p, i) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      sn: p.sn,
      online: onlineFlags[i],
      createdAt: p.createdAt,
    }));
  }

  async create(input: PrinterInput) {
    this.assertInput(input);
    const merchant = await this.prisma.merchant.findUnique({ where: { id: input.merchantId } });
    if (!merchant) throw new BizException(1004, '门店不存在', HttpStatus.OK);

    const duplicated = await this.prisma.printer.findFirst({
      where: { merchantId: input.merchantId, sn: input.sn },
    });
    if (duplicated) throw new BizException(1001, '该序列号已添加过', HttpStatus.OK);

    const printer = await this.prisma.printer.create({
      data: {
        id: this.genId(),
        merchantId: input.merchantId,
        name: input.name,
        type: input.type,
        sn: input.sn,
      },
    });
    return { id: printer.id, name: printer.name, type: printer.type, sn: printer.sn };
  }

  /** 删除打印机（仅限本门店，跨门店视为不存在） */
  async remove(id: string, merchantId: string) {
    const printer = await this.prisma.printer.findUnique({ where: { id } });
    if (!printer || printer.merchantId !== merchantId) {
      throw new BizException(1004, '打印机不存在', HttpStatus.OK);
    }
    await this.prisma.printer.delete({ where: { id } });
    return { id };
  }

  private assertInput(input: PrinterInput) {
    if (!PRINTER_TYPES.includes(input.type)) {
      throw new BizException(1001, `type 不合法，可选: ${PRINTER_TYPES.join(' / ')}`, HttpStatus.OK);
    }
    if (!input.name?.trim() || input.name.length > 50) {
      throw new BizException(1001, '打印机名称不能为空且不超过 50 字', HttpStatus.OK);
    }
    if (!input.sn?.trim() || input.sn.length > 100) {
      throw new BizException(1001, '序列号不能为空且不超过 100 字', HttpStatus.OK);
    }
  }

  private genId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `pr${ts}${rand}`.slice(0, 32);
  }
}
