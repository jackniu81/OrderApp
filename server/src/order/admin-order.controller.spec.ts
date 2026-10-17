import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrderController } from './admin-order.controller';
import { OrderService } from './order.service';
import { PrintService } from '../print/print.service';
import { BizException } from '../common/biz-exception';

const mockOrderService = {
  listByMerchant: jest.fn(),
  accept: jest.fn(),
  complete: jest.fn(),
  cancel: jest.fn(),
};

const mockPrintService = {
  printOrder: jest.fn(),
};

describe('AdminOrderController', () => {
  let controller: AdminOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrderController],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: PrintService, useValue: mockPrintService },
      ],
    }).compile();

    controller = module.get<AdminOrderController>(AdminOrderController);
    jest.clearAllMocks();
  });

  describe('GET /admin/orders', () => {
    it('缺少 merchantId 抛 1001', async () => {
      let err: any;
      try {
        await controller.list('');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BizException);
      expect(err.getCode()).toBe(1001);
    });

    it('status 不合法抛 1001', async () => {
      let err: any;
      try {
        await controller.list('m001', 'not_a_status');
      } catch (e) {
        err = e;
      }
      expect(err.getCode()).toBe(1001);
    });

    it('正常返回分页列表', async () => {
      mockOrderService.listByMerchant.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 10 });

      const result = await controller.list('m001', 'making', '2', '10');

      expect(result).toEqual({ code: 0, message: 'ok', data: { list: [], total: 0, page: 2, pageSize: 10 } });
      expect(mockOrderService.listByMerchant).toHaveBeenCalledWith('m001', 'making', 2, 10);
    });
  });

  describe('状态操作', () => {
    it('accept 返回 code 0 并透传订单', async () => {
      mockOrderService.accept.mockResolvedValue({ id: 'ord1', status: 'making' });
      const result = await controller.accept('ord1');
      expect(result).toEqual({ code: 0, message: 'ok', data: { id: 'ord1', status: 'making' } });
    });

    it('complete 返回 code 0', async () => {
      mockOrderService.complete.mockResolvedValue({ id: 'ord1', status: 'ready' });
      const result = await controller.complete('ord1');
      expect(result.code).toBe(0);
      expect(mockOrderService.complete).toHaveBeenCalledWith('ord1');
    });

    it('cancel 透传 reason', async () => {
      mockOrderService.cancel.mockResolvedValue({ id: 'ord1', status: 'cancelled' });
      const result = await controller.cancel('ord1', { reason: '门店打烊' });
      expect(result.code).toBe(0);
      expect(mockOrderService.cancel).toHaveBeenCalledWith('ord1', '门店打烊');
    });

    it('print 返回 printId', async () => {
      mockPrintService.printOrder.mockResolvedValue({ printId: 'prt_001' });
      const result = await controller.print('ord1');
      expect(result).toEqual({ code: 0, message: 'ok', data: { printId: 'prt_001' } });
    });
  });
});
