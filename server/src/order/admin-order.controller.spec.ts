import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AdminOrderController } from './admin-order.controller';
import { OrderService } from './order.service';
import { PrintService } from '../print/print.service';
import { BizException } from '../common/biz-exception';

const mockOrderService = {
  listByMerchant: jest.fn(),
  getForMerchant: jest.fn(),
  accept: jest.fn(),
  complete: jest.fn(),
  cancel: jest.fn(),
};

const mockPrintService = {
  printOrder: jest.fn(),
};

/** Guard 校验后的请求对象，控制器单测不经过 HTTP 层，直接传入 */
const req = { admin: { merchantId: 'm001' } } as any;

describe('AdminOrderController', () => {
  let controller: AdminOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrderController],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: PrintService, useValue: mockPrintService },
        // @UseGuards(AdminAuthGuard) 会被实例化，但控制器单测不经过 HTTP 层， stub 依赖即可
        { provide: JwtService, useValue: {} },
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

  describe('GET /admin/orders/:id', () => {
    it('按 token 门店查询详情', async () => {
      mockOrderService.getForMerchant.mockResolvedValue({ id: 'ord1', status: 'making' });

      const result = await controller.detail('ord1', req);

      expect(result).toEqual({ code: 0, message: 'ok', data: { id: 'ord1', status: 'making' } });
      expect(mockOrderService.getForMerchant).toHaveBeenCalledWith('ord1', 'm001');
    });

    it('订单属于其他门店抛 1003', async () => {
      mockOrderService.getForMerchant.mockRejectedValue(new BizException(1003, '无权操作该订单'));

      await expect(controller.detail('ord1', req)).rejects.toMatchObject({ response: { code: 1003 } });
    });
  });

  describe('状态操作', () => {
    it('accept 先校验归属再流转', async () => {
      mockOrderService.getForMerchant.mockResolvedValue({ id: 'ord1', merchantId: 'm001' });
      mockOrderService.accept.mockResolvedValue({ id: 'ord1', status: 'making' });
      const result = await controller.accept('ord1', req);
      expect(result).toEqual({ code: 0, message: 'ok', data: { id: 'ord1', status: 'making' } });
      expect(mockOrderService.getForMerchant).toHaveBeenCalledWith('ord1', 'm001');
    });

    it('归属校验失败时不执行流转', async () => {
      mockOrderService.getForMerchant.mockRejectedValue(new BizException(1003, '无权操作该订单'));

      await expect(controller.accept('ord1', req)).rejects.toBeInstanceOf(BizException);
      expect(mockOrderService.accept).not.toHaveBeenCalled();
    });

    it('complete 返回 code 0', async () => {
      mockOrderService.getForMerchant.mockResolvedValue({ id: 'ord1', merchantId: 'm001' });
      mockOrderService.complete.mockResolvedValue({ id: 'ord1', status: 'ready' });
      const result = await controller.complete('ord1', req);
      expect(result.code).toBe(0);
      expect(mockOrderService.complete).toHaveBeenCalledWith('ord1');
    });

    it('cancel 透传 reason', async () => {
      mockOrderService.getForMerchant.mockResolvedValue({ id: 'ord1', merchantId: 'm001' });
      mockOrderService.cancel.mockResolvedValue({ id: 'ord1', status: 'cancelled' });
      const result = await controller.cancel('ord1', { reason: '门店打烊' }, req);
      expect(result.code).toBe(0);
      expect(mockOrderService.cancel).toHaveBeenCalledWith('ord1', '门店打烊');
    });

    it('print 透传 printerId', async () => {
      mockOrderService.getForMerchant.mockResolvedValue({ id: 'ord1', merchantId: 'm001' });
      mockPrintService.printOrder.mockResolvedValue({ printId: 'prt_001' });
      const result = await controller.print('ord1', { printerId: 'pr001' }, req);
      expect(result).toEqual({ code: 0, message: 'ok', data: { printId: 'prt_001' } });
      expect(mockPrintService.printOrder).toHaveBeenCalledWith('ord1', 'pr001');
    });

    it('print 未指定 printerId 时传 undefined', async () => {
      mockOrderService.getForMerchant.mockResolvedValue({ id: 'ord1', merchantId: 'm001' });
      mockPrintService.printOrder.mockResolvedValue({ printId: 'prt_002' });
      await controller.print('ord1', {}, req);
      expect(mockPrintService.printOrder).toHaveBeenCalledWith('ord1', undefined);
    });
  });
});
