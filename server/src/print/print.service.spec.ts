import { PrintService } from './print.service';
import { BizException } from '../common/biz-exception';
import { PrinterDriver } from './printer-driver';

const order = {
  id: 'ord1',
  outTradeNo: 'mm001_20261017_0001',
  merchantId: 'm001',
  openid: 'oX',
  status: 'pending_accept',
  totalAmount: 4000,
  payMethod: 'wechat',
  remark: '不要香菜',
  createdAt: new Date('2026-10-17T10:30:00Z'),
  items: [
    {
      id: 'oi1',
      orderId: 'ord1',
      productId: 'p001',
      productName: '珍珠奶茶',
      productImage: null,
      price: 2000,
      quantity: 2,
      specSnapshot: '杯型：大杯 / 加料：珍珠',
      remark: '少糖',
      subtotal: 4000,
    },
  ],
};

const printer = { id: 'pr001', merchantId: 'm001', name: '前台打印机', type: 'feie', sn: 'SN123', createdAt: new Date(), updatedAt: new Date() };

describe('PrintService', () => {
  let service: PrintService;
  let prismaMock: any;
  let driverMock: jest.Mocked<PrinterDriver>;

  beforeEach(() => {
    prismaMock = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      printer: { findFirst: jest.fn().mockResolvedValue(printer) },
    };
    driverMock = {
      isOnline: jest.fn().mockResolvedValue(true),
      submit: jest.fn().mockResolvedValue('prt_test1'),
    };
    service = new PrintService(prismaMock, driverMock);
  });

  it('打印机在线时返回 printId 并下发小票内容', async () => {
    const result = await service.printOrder('ord1');

    expect(result).toEqual({ printId: 'prt_test1' });
    expect(driverMock.submit).toHaveBeenCalledWith(printer, expect.any(String));
    const content = driverMock.submit.mock.calls[0][1];
    expect(content).toContain('珍珠奶茶 x2');
    expect(content).toContain('杯型：大杯 / 加料：珍珠');
    expect(content).toContain('合计: 4000分');
  });

  it('订单不存在抛 1004', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(service.printOrder('nope')).rejects.toBeInstanceOf(BizException);
  });

  it('未配置打印机抛 4001', async () => {
    prismaMock.printer.findFirst.mockResolvedValue(null);
    let err: any;
    try {
      await service.printOrder('ord1');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BizException);
    expect(err.getCode()).toBe(4001);
    expect(driverMock.submit).not.toHaveBeenCalled();
  });

  it('打印机离线抛 4001', async () => {
    driverMock.isOnline.mockResolvedValue(false);
    let err: any;
    try {
      await service.printOrder('ord1');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BizException);
    expect(err.getCode()).toBe(4001);
    expect(driverMock.submit).not.toHaveBeenCalled();
  });

  it('指定 printerId 时按该打印机出票', async () => {
    const second = { ...printer, id: 'pr002', name: '后厨打印机', sn: 'SN456' };
    prismaMock.printer.findFirst.mockResolvedValue(second);

    await service.printOrder('ord1', 'pr002');

    expect(prismaMock.printer.findFirst).toHaveBeenCalledWith({ where: { id: 'pr002', merchantId: 'm001' } });
    expect(driverMock.submit).toHaveBeenCalledWith(second, expect.any(String));
  });

  it('指定的打印机不属于本门店抛 4001', async () => {
    prismaMock.printer.findFirst.mockResolvedValue(null);
    let err: any;
    try {
      await service.printOrder('ord1', 'pr999');
    } catch (e) {
      err = e;
    }
    expect(err.getCode()).toBe(4001);
    expect(err.message).toBe('打印机不存在');
  });
});
