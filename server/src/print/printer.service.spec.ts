import { PrinterService } from './printer.service';
import { BizException } from '../common/biz-exception';
import { PrinterDriver } from './printer-driver';

const printer = {
  id: 'pr001',
  merchantId: 'm001',
  name: '前台打印机',
  type: 'feie',
  sn: 'SN123',
  createdAt: new Date('2026-10-17T10:00:00Z'),
  updatedAt: new Date('2026-10-17T10:00:00Z'),
};

describe('PrinterService', () => {
  let service: PrinterService;
  let prismaMock: any;
  let driverMock: jest.Mocked<PrinterDriver>;

  beforeEach(() => {
    prismaMock = {
      merchant: { findUnique: jest.fn().mockResolvedValue({ id: 'm001' }) },
      printer: {
        findMany: jest.fn().mockResolvedValue([printer]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(printer),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    driverMock = {
      isOnline: jest.fn().mockResolvedValue(true),
      submit: jest.fn().mockResolvedValue('prt_test1'),
    };
    service = new PrinterService(prismaMock, driverMock);
  });

  it('列表返回驱动查询到的在线状态', async () => {
    const result = await service.list('m001');

    expect(result).toEqual([
      { id: 'pr001', name: '前台打印机', type: 'feie', sn: 'SN123', online: true, createdAt: printer.createdAt },
    ]);
    expect(driverMock.isOnline).toHaveBeenCalledWith(printer);
  });

  it('添加打印机落库并返回摘要', async () => {
    const result = await service.create({ merchantId: 'm001', name: '后厨打印机', type: 'xprinter', sn: 'SN456' });

    expect(prismaMock.printer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ merchantId: 'm001', name: '后厨打印机', type: 'xprinter', sn: 'SN456' }),
    });
    expect(result).toEqual({ id: expect.any(String), name: '后厨打印机', type: 'xprinter', sn: 'SN456' });
  });

  it('厂商类型不合法抛 1001', async () => {
    await expect(
      service.create({ merchantId: 'm001', name: '打印机', type: 'unknown', sn: 'SN1' }),
    ).rejects.toBeInstanceOf(BizException);
    expect(prismaMock.printer.create).not.toHaveBeenCalled();
  });

  it('同门店重复序列号抛 1001', async () => {
    prismaMock.printer.findFirst.mockResolvedValue(printer);
    let err: any;
    try {
      await service.create({ merchantId: 'm001', name: '打印机', type: 'feie', sn: 'SN123' });
    } catch (e) {
      err = e;
    }
    expect(err.getCode()).toBe(1001);
  });

  it('门店不存在抛 1004', async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(null);
    let err: any;
    try {
      await service.create({ merchantId: 'm999', name: '打印机', type: 'feie', sn: 'SN1' });
    } catch (e) {
      err = e;
    }
    expect(err.getCode()).toBe(1004);
  });

  it('删除其他门店的打印机视为不存在（1004）', async () => {
    prismaMock.printer.findUnique.mockResolvedValue({ ...printer, merchantId: 'm002' });

    let err: any;
    try {
      await service.remove('pr001', 'm001');
    } catch (e) {
      err = e;
    }
    expect(err.getCode()).toBe(1004);
    expect(prismaMock.printer.delete).not.toHaveBeenCalled();
  });
});
