import { EventEmitter } from 'events';
import { OrderService, CreateOrderInput } from './order.service';
import { BizException } from '../common/biz-exception';

function buildProduct(
  id: string,
  stock: number,
  price: number,
  specGroups: { id: string; name: string; type: 'single' | 'multi'; required: boolean; options: { id: string; name: string; priceDelta: number }[] }[],
) {
  return {
    id,
    merchantId: 'm001',
    categoryId: 'c1',
    name: `商品${id}`,
    description: null,
    image: null,
    price,
    stock,
    onSale: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    specGroups: specGroups.map((sg) => ({
      sort: 1,
      specGroup: {
        id: sg.id,
        merchantId: 'm001',
        name: sg.name,
        type: sg.type,
        required: sg.required,
        createdAt: new Date(),
        updatedAt: new Date(),
        options: sg.options.map((o) => ({
          id: o.id,
          groupId: sg.id,
          name: o.name,
          priceDelta: o.priceDelta,
          sort: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    })),
  };
}

describe('OrderService', () => {
  let service: OrderService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisMock: any;

  const merchant = {
    id: 'm001',
    name: '示例奶茶店',
    isOpen: true,
    payOnSiteEnabled: true,
  };

  const productPearl = buildProduct(
    'p001',
    10,
    1500,
    [
      {
        id: 'g1',
        name: '杯型',
        type: 'single',
        required: true,
        options: [
          { id: 'o1', name: '中杯', priceDelta: 0 },
          { id: 'o2', name: '大杯', priceDelta: 300 },
        ],
      },
      {
        id: 'g2',
        name: '加料',
        type: 'multi',
        required: false,
        options: [{ id: 'o3', name: '珍珠', priceDelta: 200 }],
      },
    ],
  );

  function setupMocks() {
    prismaMock = {
      merchant: { findUnique: jest.fn().mockResolvedValue(merchant) },
      product: {
        findMany: jest.fn().mockResolvedValue([productPearl]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'p001' }),
      },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'ord1', status: 'pending_payment' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { upsert: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((arg) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        const tx = {
          product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          order: { create: jest.fn().mockResolvedValue({ id: 'ord1', status: 'pending_payment' }) },
          orderItem: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
          user: { upsert: jest.fn().mockResolvedValue(null) },
        };
        return arg(tx);
      }),
    };
    redisClientMock = {
      set: jest.fn().mockResolvedValue('OK'),
      decrby: jest.fn().mockResolvedValue(5),
      incrby: jest.fn().mockResolvedValue(5),
      expire: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    redisMock = { client: redisClientMock };
    service = new OrderService(prismaMock, redisMock);
  }

  beforeEach(() => setupMocks());

  describe('createOrder', () => {
    const baseInput: CreateOrderInput = {
      merchantId: 'm001',
      openid: 'oTestOpenid',
      items: [
        {
          productId: 'p001',
          quantity: 2,
          specs: [
            { groupId: 'g1', optionIds: ['o2'] }, // 大杯 +300
            { groupId: 'g2', optionIds: ['o3'] }, // 加料珍珠 +200
          ],
          remark: '少糖',
        },
      ],
      remark: '不要香菜',
      payMethod: 'wechat',
    };

    it('正常下单：计算总价 + 预扣 + 落库', async () => {
      const result = await service.createOrder(baseInput);

      expect(result).toHaveProperty('orderId');
      expect(result).toHaveProperty('outTradeNo');
      expect(result.status).toBe('pending_payment');
      // 大杯(1500+300=1800) + 加料(+200=2000) × 2 = 4000
      expect(result.totalAmount).toBe(4000);

      // Redis 预扣 DECR
      expect(redisClientMock.decrby).toHaveBeenCalledWith('stock:pre:p001', 2);
      expect(redisClientMock.expire).toHaveBeenCalledWith('stock:pre:p001', 900);
    });

    it('库存不足时抛 2001', async () => {
      // 前置校验: quantity > product.stock
      const input = {
        ...baseInput,
        items: [{ ...baseInput.items[0], quantity: 9999 }],
      };
      await expect(service.createOrder(input)).rejects.toBeInstanceOf(BizException);
      try {
        await service.createOrder(input);
      } catch (e: any) {
        expect(e.getCode()).toBe(2001);
      }
      // 未走到 Redis 预扣分支
      expect(redisClientMock.decrby).not.toHaveBeenCalled();
    });

    it('门店不存在抛 1004', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);
      await expect(service.createOrder(baseInput)).rejects.toBeInstanceOf(BizException);
      try {
        await service.createOrder(baseInput);
      } catch (e: any) {
        expect(e.getCode()).toBe(1004);
      }
    });

    it('门店打烊抛业务码 2000', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue({ ...merchant, isOpen: false });
      await expect(service.createOrder(baseInput)).rejects.toBeInstanceOf(BizException);
      try {
        await service.createOrder(baseInput);
      } catch (e: any) {
        expect(e.getCode()).toBe(2000);
      }
    });

    it('商品已下架抛 2003', async () => {
      prismaMock.product.findMany.mockResolvedValue([{ ...productPearl, onSale: false }]);
      await expect(service.createOrder(baseInput)).rejects.toBeInstanceOf(BizException);
      try {
        await service.createOrder(baseInput);
      } catch (e: any) {
        expect(e.getCode()).toBe(2003);
      }
    });

    it('必填规格未选抛 1001', async () => {
      const input = {
        ...baseInput,
        items: [{ ...baseInput.items[0], specs: [{ groupId: 'g1', optionIds: [] }] }],
      };
      await expect(service.createOrder(input)).rejects.toBeInstanceOf(BizException);
      try {
        await service.createOrder(input);
      } catch (e: any) {
        expect(e.getCode()).toBe(1001);
      }
    });

    it('预扣键缺失时按 DB 库存初始化后再扣减', async () => {
      await service.createOrder(baseInput);
      // productPearl.stock = 10；SET NX 只在键不存在时写入，不会覆盖已有的并发预扣计数
      expect(redisClientMock.set).toHaveBeenCalledWith('stock:pre:p001', '10', 'NX');
    });

    it('门店未开启到店支付时 on_site 下单抛 1001', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue({ ...merchant, payOnSiteEnabled: false });
      let err: any;
      try {
        await service.createOrder({ ...baseInput, payMethod: 'on_site' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BizException);
      expect(err.getCode()).toBe(1001);
      expect(redisClientMock.decrby).not.toHaveBeenCalled();
    });
  });

  describe('releasePreDeduction', () => {
    it('释放预扣并删除记录', async () => {
      await service.releasePreDeduction('ord1', [
        { productId: 'p001', quantity: 2 },
        { productId: 'p002', quantity: 1 },
      ]);
      expect(redisClientMock.incrby).toHaveBeenCalledWith('stock:pre:p001', 2);
      expect(redisClientMock.incrby).toHaveBeenCalledWith('stock:pre:p002', 1);
      expect(redisClientMock.del).toHaveBeenCalledWith('order:created:ord1');
    });
  });

  describe('cancel', () => {
    const paidOrder = {
      id: 'ord1',
      merchantId: 'm001',
      openid: 'oTestOpenid',
      status: 'pending_accept',
      payStatus: 'paid',
      items: [{ productId: 'p001', quantity: 2 }],
    };

    it('Redis 预扣与 DB 库存一并归还', async () => {
      prismaMock.order.findUnique.mockResolvedValue(paidOrder);
      prismaMock.order.update.mockResolvedValue({ ...paidOrder, status: 'cancelled' });

      await service.cancel('ord1', '门店打烊');

      expect(redisClientMock.incrby).toHaveBeenCalledWith('stock:pre:p001', 2);
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'p001' },
        data: { stock: { increment: 2 } },
      });
    });

    it('推送 order:status 让顾客端实时看到取消', async () => {
      const bus = new EventEmitter();
      const statusEvents: any[] = [];
      bus.on('order:status', (payload) => statusEvents.push(payload));
      service = new OrderService(prismaMock, redisMock, bus);
      prismaMock.order.findUnique.mockResolvedValue(paidOrder);
      prismaMock.order.update.mockResolvedValue({ ...paidOrder, status: 'cancelled' });

      await service.cancel('ord1', '门店打烊');

      expect(statusEvents[0]).toMatchObject({ orderId: 'ord1', status: 'cancelled', merchantId: 'm001' });
    });
  });

  describe('confirmOnSitePayment', () => {
    const onSiteOrder = {
      id: 'ord1',
      merchantId: 'm001',
      openid: 'oTestOpenid',
      status: 'pending_payment',
      payMethod: 'on_site',
      totalAmount: 4000,
      items: [{ productName: '商品p001', quantity: 2 }],
    };

    it('确认收款后置为已支付与待接单，并推送新单提醒', async () => {
      const bus = new EventEmitter();
      const newEvents: any[] = [];
      const statusEvents: any[] = [];
      bus.on('order:new', (payload) => newEvents.push(payload));
      bus.on('order:status', (payload) => statusEvents.push(payload));
      service = new OrderService(prismaMock, redisMock, bus);
      prismaMock.order.findUnique.mockResolvedValue(onSiteOrder);
      prismaMock.order.update.mockResolvedValue({ ...onSiteOrder, status: 'pending_accept' });

      const updated = await service.confirmOnSitePayment('ord1');

      expect(updated.status).toBe('pending_accept');
      // 流转接口返回完整订单（含 items），客户端可直接渲染
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'ord1' },
        data: { status: 'pending_accept', payStatus: 'paid', paidAt: expect.any(Date) },
        include: { items: true },
      });
      expect(newEvents[0]).toMatchObject({
        orderId: 'ord1',
        merchantId: 'm001',
        totalAmount: 4000,
        items: [{ productName: '商品p001', quantity: 2 }],
      });
      expect(statusEvents[0]).toMatchObject({ orderId: 'ord1', status: 'pending_accept' });
    });

    it('微信支付订单确认收款抛 2002', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...onSiteOrder, payMethod: 'wechat' });
      let err: any;
      try {
        await service.confirmOnSitePayment('ord1');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BizException);
      expect(err.getCode()).toBe(2002);
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });
  });
});
