# 02 - 领域模型（Domain Model）

> 本文档定义核心领域对象及其关系，以及订单状态机。后端实现须严格遵循状态机的合法转换。

## 1. 领域对象

### 1.1 Merchant（门店）

| 字段 | 说明 |
|---|---|
| id | 门店 ID |
| name | 门店名称 |
| logo | Logo URL |
| address | 地址 |
| phone | 联系电话 |
| businessHours | 营业时间（如 "09:00-22:00"） |
| isOpen | 是否营业中 |
| payOnSiteEnabled | 是否允许到店支付 |
| notice | 门店公告 |

### 1.2 Category（分类）

| 字段 | 说明 |
|---|---|
| id | 分类 ID |
| merchantId | 所属门店 |
| name | 分类名称 |
| sort | 排序（升序） |
| visible | 是否对顾客可见 |

### 1.3 Product（商品）

| 字段 | 说明 |
|---|---|
| id | 商品 ID |
| merchantId | 所属门店 |
| categoryId | 所属分类 |
| name | 商品名称 |
| description | 描述 |
| image | 图片 URL |
| price | 基础价格（分） |
| stock | 库存数量 |
| onSale | 是否上架 |
| specGroupIds | 关联的规格组 ID 列表 |

**派生状态：** `soldOut = stock <= 0 || !onSale`

### 1.4 SpecGroup（规格组）

| 字段 | 说明 |
|---|---|
| id | 规格组 ID |
| merchantId | 所属门店 |
| name | 规格组名称（如"杯型"） |
| type | `single`（单选）/ `multi`（多选） |
| required | 是否必选 |
| options | 规格选项列表 |

### 1.5 SpecOption（规格选项）

| 字段 | 说明 |
|---|---|
| id | 选项 ID |
| groupId | 所属规格组 |
| name | 选项名称 |
| priceDelta | 加价（分） |

### 1.6 Order（订单）

| 字段 | 说明 |
|---|---|
| id | 订单 ID |
| outTradeNo | 商户订单号（全局唯一） |
| merchantId | 所属门店 |
| openid | 顾客 openid |
| status | 订单状态（见状态机） |
| totalAmount | 总金额（分） |
| payMethod | `wechat` / `on_site` |
| payStatus | `unpaid` / `paid` / `refunding` / `refunded` |
| remark | 订单备注 |
| createdAt / paidAt / acceptedAt / completedAt / cancelledAt | 时间戳 |

### 1.7 OrderItem（订单明细）

> 存商品与规格的**快照**，不随菜单变更而改变。

| 字段 | 说明 |
|---|---|
| id | 明细 ID |
| orderId | 所属订单 |
| productId | 商品 ID |
| productName | 商品名称快照 |
| productImage | 商品图片快照 |
| price | 单价快照（分） |
| quantity | 数量 |
| specSnapshot | 规格文本快照（如"大杯 / 加料：珍珠"） |
| remark | 单品备注 |
| subtotal | 小计（分）= (price + 规格加价) × quantity |

### 1.8 Payment（支付流水）

| 字段 | 说明 |
|---|---|
| id | 流水 ID |
| outTradeNo | 商户订单号 |
| transactionId | 微信支付交易号 |
| amount | 金额（分） |
| status | `pending` / `success` / `failed` / `refunded` |
| paidAt | 支付时间 |

### 1.9 Printer（打印机）

| 字段 | 说明 |
|---|---|
| id | 打印机 ID |
| merchantId | 所属门店 |
| name | 打印机名称 |
| type | 厂商类型（feie / xprinter / sunmi） |
| sn | 设备序列号 |

### 1.10 User（顾客）

| 字段 | 说明 |
|---|---|
| openid | 微信 openid（主键） |
| createdAt | 首次登录时间 |

> 第一版不收集手机号、昵称等非必要信息。

## 2. 领域关系

```
Merchant 1──* Category
Merchant 1──* Product
Merchant 1──* SpecGroup
Merchant 1──* Printer
Merchant 1──* Order

Category 1──* Product
Product *──* SpecGroup（通过 specGroupIds）
SpecGroup 1──* SpecOption

Order 1──* OrderItem
Order 1──1 Payment（通过 outTradeNo）
Order *──1 User（通过 openid）
```

## 3. 订单状态机

### 3.1 状态定义

| 状态 | 含义 |
|---|---|
| `pending_payment` | 待支付（已下单未支付） |
| `pending_accept` | 待接单（已支付，等待商家接单） |
| `making` | 制作中（商家已接单） |
| `ready` | 可取餐（制作完成） |
| `completed` | 已完成 |
| `cancelled` | 已取消 |
| `refunding` | 退款中 |
| `refunded` | 已退款 |

### 3.2 状态流转图

```
                    ┌─────────────────┐
                    │ pending_payment │  下单后
                    └────────┬────────┘
                             │
              支付成功 ──────┼────── 顾客/商家取消
                             │                │
                             ▼                ▼
                    ┌────────────────┐   cancelled
                    │ pending_accept │
                    └────────┬───────┘
                             │
              商家接单 ──────┼────── 商家取消（自动退款）
                             │                │
                             ▼                ▼
                       ┌──────────┐      refunding → refunded
                       │  making  │
                       └────┬─────┘
                            │
              商家完成 ─────┘
                            │
                            ▼
                       ┌──────────┐
                       │  ready   │
                       └────┬─────┘
                            │
              确认取餐 ─────┘
                            │
                            ▼
                       ┌───────────┐
                       │ completed │
                       └───────────┘
```

### 3.3 合法转换表

| 当前状态 | 目标状态 | 触发方 | 触发条件 | 副作用 |
|---|---|---|---|---|
| `pending_payment` | `pending_accept` | 系统 | 微信支付回调成功 | 扣减库存、推送新单 |
| `pending_payment` | `cancelled` | 顾客/系统 | 顾客取消或支付超时 | 释放预扣库存 |
| `pending_accept` | `making` | 商家 | 商家接单 | 推送顾客 |
| `pending_accept` | `cancelled` | 顾客/商家 | 取消订单 | 已支付则发起退款，释放库存 |
| `making` | `ready` | 商家/后厨 | 制作完成 | 推送顾客取餐通知 |
| `making` | `cancelled` | 商家 | 商家取消（异常） | 发起退款，释放库存 |
| `ready` | `completed` | 顾客/商家 | 确认取餐/完成 | 记录完成时间 |
| 任意已支付状态 | `refunding` | 商家 | 发起退款 | 调用微信退款 API |
| `refunding` | `refunded` | 系统 | 退款回调成功 | 释放库存 |

### 3.4 非法转换处理

任何不在上表中的状态转换返回错误码 `2002`（订单状态不允许此操作）。

## 4. 库存机制

### 4.1 预扣与释放

1. **下单时**：预扣库存（Redis `DECR`）+ 数据库 CAS 扣减（`stock` -N），订单进入 `pending_payment`
2. **支付成功**：预扣转正（不再重复扣减），订单进入 `pending_accept`
3. **订单取消**：Redis `INCR` 与数据库 `stock` +N 一并归还，订单进入 `cancelled`

> Redis 键 `stock:pre:{productId}` 是数据库库存的原子计数镜像：键缺失（首次下单、TTL 到期、Redis 重启）时按当时的 `product.stock` 用 `SET NX` 初始化，再执行 `DECR`，因此无需单独的数据装载步骤，也不会覆盖并发预扣的中间值。

### 4.2 防超卖

- 预扣使用 Redis 原子操作，`stock < 0` 时回滚并返回 `2001`
- 数据库层加乐观锁（`stock` 字段 CAS 更新）作为兜底
- 预扣计数键 TTL 15 分钟，到期后按数据库库存重新初始化
- **待接入**：超过 15 分钟未支付的订单目前不会自动取消，占用的库存需顾客或商家取消后才归还（自动释放需与支付回调竞态一起处理，见 issue 待办）

### 4.3 库存扣减时机

| 事件 | 库存变化 |
|---|---|
| 下单 | 预扣（-N） |
| 支付成功 | 预扣转正（不重复扣） |
| 订单取消/退款 | 释放（+N） |
