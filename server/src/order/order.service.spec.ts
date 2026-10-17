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
      },
      order: { create: jest.fn().mockResolvedValue({ id: 'ord1', status: 'pending_payment' }) },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { upsert: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((cb) => {
        const tx = {
          product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          order: { create: jest.fn().mockResolvedValue({ id: 'ord1', status: 'pending_payment' }) },
          orderItem: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
          user: { upsert: jest.fn().mockResolvedValue(null) },
        };
        return cb(tx);
      }),
    };
    redisClientMock = {
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
});
