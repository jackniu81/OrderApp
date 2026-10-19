import { EventEmitter } from 'events';
import { PaymentService } from './payment.service';
import { BizException } from '../common/biz-exception';

describe('PaymentService', () => {
  let service: PaymentService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisMock: any;

  const baseOrder = {
    id: 'ord1',
    outTradeNo: 'm001_20261017103000_0001',
    merchantId: 'm001',
    status: 'pending_payment',
    totalAmount: 3600,
    payStatus: 'unpaid',
    payMethod: 'wechat',
  };

  function setupMocks() {
    prismaMock = {
      order: {
        findUnique: jest.fn().mockResolvedValue(baseOrder),
        update: jest.fn().mockResolvedValue({ ...baseOrder, status: 'pending_accept' }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(null),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'oi1', productName: '珍珠奶茶', quantity: 2 },
        ]),
      },
      $transaction: jest.fn().mockImplementation((cb) => {
        const tx = {
          order: { update: jest.fn().mockResolvedValue(null) },
          payment: { create: jest.fn().mockResolvedValue(null) },
        };
        return cb(tx);
      }),
    };
    redisClientMock = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    redisMock = { client: redisClientMock };

    // 跳过构造函数 initSdk（没有真实证书）
    jest.isolateModules(() => {
      service = new PaymentService(prismaMock, redisMock);
    });
  }

  beforeEach(() => setupMocks());

  describe('handleWxNotify', () => {
    it('正常回调 → 订单 pending_payment → pending_accept + 写 Payment', async () => {
      const result = await service.handleWxNotify({
        out_trade_no: 'm001_20261017103000_0001',
        transaction_id: '4200000000000000000000',
        result_code: 'SUCCESS',
      });

      expect(result).toEqual({ code: 'SUCCESS', message: 'OK' });

      // 幂等标记
      expect(redisClientMock.setex).toHaveBeenCalledWith(
        'pay:idempotency:m001_20261017103000_0001',
        900,
        'ok',
      );

      // 事务内更新订单 + 写支付流水
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('回调重复到达 → 幂等命中直接返回 SUCCESS', async () => {
      redisClientMock.get.mockResolvedValue('ok'); // 已处理过

      const result = await service.handleWxNotify({
        out_trade_no: 'm001_20261017103000_0001',
        transaction_id: '4200000000000000000000',
        result_code: 'SUCCESS',
      });

      expect(result).toEqual({ code: 'SUCCESS', message: 'OK' });
      // 不会走 DB
      expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
    });

    it('订单已非 pending_payment → 返回 SUCCESS（不重复处理）', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: 'pending_accept', // 已经处理过
      });

      const result = await service.handleWxNotify({
        out_trade_no: 'm001_20261017103000_0001',
        transaction_id: '4200000000000000000000',
        result_code: 'SUCCESS',
      });

      expect(result).toEqual({ code: 'SUCCESS', message: 'OK' });
    });

    it('订单不存在 → 返回 FAIL 让微信重试', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      const result = await service.handleWxNotify({
        out_trade_no: 'unknown_trade_no',
        transaction_id: 'xxx',
        result_code: 'SUCCESS',
      });

      expect(result).toEqual({ code: 'FAIL', message: '订单不存在' });
    });

    it('result_code != SUCCESS → 标记幂等但不流转状态', async () => {
      const result = await service.handleWxNotify({
        out_trade_no: 'm001_20261017103000_0001',
        transaction_id: null,
        result_code: 'FAIL',
      });

      expect(result.code).toBe('SUCCESS'); // 微信要求返回成功避免重试风暴
      // 幂等标记为 failed
      expect(redisClientMock.setex).toHaveBeenCalledWith(
        'pay:idempotency:m001_20261017103000_0001',
        900,
        'failed',
      );
    });

    it('缺 out_trade_no → 返回 FAIL', async () => {
      const result = await service.handleWxNotify({});
      expect(result).toEqual({ code: 'FAIL', message: '参数错误' });
    });
  });

  describe('新单推送（商家端 WS 提醒）', () => {
    it('支付成功后向 EVENT_BUS 发出 order:new', async () => {
      const bus = new EventEmitter();
      const received: any[] = [];
      bus.on('order:new', (payload) => received.push(payload));
      const svc = new PaymentService(prismaMock, redisMock, undefined, bus);

      await svc.handleWxNotify({
        out_trade_no: 'm001_20261017103000_0001',
        transaction_id: '4200000000000000000000',
        result_code: 'SUCCESS',
      });

      expect(received).toEqual([
        {
          orderId: 'ord1',
          merchantId: 'm001',
          items: [{ productName: '珍珠奶茶', quantity: 2 }],
          totalAmount: 3600,
        },
      ]);
    });

    it('支付失败不推送新单', async () => {
      const bus = new EventEmitter();
      const received: any[] = [];
      bus.on('order:new', (payload) => received.push(payload));
      const svc = new PaymentService(prismaMock, redisMock, undefined, bus);

      await svc.handleWxNotify({
        out_trade_no: 'm001_20261017103000_0001',
        result_code: 'FAIL',
      });

      expect(received).toHaveLength(0);
    });
  });

  describe('getStatus', () => {
    it('返回订单 payStatus + Payment transactionId', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...baseOrder,
        payStatus: 'paid',
      });
      prismaMock.payment.findUnique.mockResolvedValue({
        outTradeNo: 'm001_20261017103000_0001',
        transactionId: '4200000000000000000000',
        paidAt: new Date('2026-10-17T10:30:15+08:00'),
      });

      const data = await service.getStatus('m001_20261017103000_0001');
      expect(data.outTradeNo).toBe('m001_20261017103000_0001');
      expect(data.status).toBe('paid');
      expect(data.transactionId).toBe('4200000000000000000000');
    });

    it('订单不存在 → BizException 1004', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('unknown')).rejects.toBeInstanceOf(BizException);
    });
  });
});
