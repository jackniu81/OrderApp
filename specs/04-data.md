# 04 - 数据模型（Data Schema）

> 本文档定义数据库表结构、字段含义与索引。后端使用 Prisma ORM，以本文档为准生成 schema。

## 1. 通用约定

- 数据库：MySQL 8.0+
- 字符集：`utf8mb4`
- 金额：`INT`（单位：分）
- 时间：`DATETIME(3)`，所有表带 `createdAt`、`updatedAt`
- 主键：`VARCHAR(32)`，使用雪花 ID 或 UUID
- 软删除：第一版不使用，直接物理删除（订单除外，订单不可删）

## 2. 表结构

### 2.1 merchant（门店）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 门店 ID |
| name | VARCHAR(100) | NOT NULL | 门店名称 |
| logo | VARCHAR(255) | | Logo URL |
| address | VARCHAR(255) | | 地址 |
| phone | VARCHAR(20) | | 联系电话 |
| businessHours | VARCHAR(50) | | 营业时间，如 "09:00-22:00" |
| isOpen | TINYINT(1) | DEFAULT 1 | 是否营业中 |
| payOnSiteEnabled | TINYINT(1) | DEFAULT 0 | 是否允许到店支付 |
| notice | VARCHAR(500) | | 门店公告 |
| createdAt | DATETIME(3) | | 创建时间 |
| updatedAt | DATETIME(3) | | 更新时间 |

### 2.2 category（分类）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 分类 ID |
| merchantId | VARCHAR(32) | NOT NULL, FK→merchant.id | 所属门店 |
| name | VARCHAR(50) | NOT NULL | 分类名称 |
| sort | INT | DEFAULT 0 | 排序（升序） |
| visible | TINYINT(1) | DEFAULT 1 | 是否可见 |
| createdAt | DATETIME(3) | | |
| updatedAt | DATETIME(3) | | |

**索引：** `INDEX idx_merchant_sort (merchantId, sort)`

### 2.3 product（商品）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 商品 ID |
| merchantId | VARCHAR(32) | NOT NULL, FK→merchant.id | 所属门店 |
| categoryId | VARCHAR(32) | NOT NULL, FK→category.id | 所属分类 |
| name | VARCHAR(100) | NOT NULL | 商品名称 |
| description | VARCHAR(500) | | 描述 |
| image | VARCHAR(255) | | 图片 URL |
| price | INT | NOT NULL | 基础价格（分） |
| stock | INT | NOT NULL DEFAULT 0 | 库存 |
| onSale | TINYINT(1) | DEFAULT 1 | 是否上架 |
| createdAt | DATETIME(3) | | |
| updatedAt | DATETIME(3) | | |

**索引：**
- `INDEX idx_merchant_category (merchantId, categoryId)`
- `INDEX idx_on_sale (onSale)`

**说明：** `specGroupIds` 不存数据库外键，通过关联表 `product_spec_group` 维护。

### 2.4 product_spec_group（商品-规格组关联）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | |
| productId | VARCHAR(32) | NOT NULL, FK→product.id | 商品 ID |
| specGroupId | VARCHAR(32) | NOT NULL, FK→spec_group.id | 规格组 ID |
| sort | INT | DEFAULT 0 | 规格组在该商品中的排序 |

**索引：** `UNIQUE KEY uk_product_group (productId, specGroupId)`

### 2.5 spec_group（规格组）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 规格组 ID |
| merchantId | VARCHAR(32) | NOT NULL, FK→merchant.id | 所属门店 |
| name | VARCHAR(50) | NOT NULL | 规格组名称 |
| type | VARCHAR(10) | NOT NULL | `single` / `multi` |
| required | TINYINT(1) | DEFAULT 0 | 是否必选 |
| createdAt | DATETIME(3) | | |
| updatedAt | DATETIME(3) | | |

**索引：** `INDEX idx_merchant (merchantId)`

### 2.6 spec_option（规格选项）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 选项 ID |
| groupId | VARCHAR(32) | NOT NULL, FK→spec_group.id | 所属规格组 |
| name | VARCHAR(50) | NOT NULL | 选项名称 |
| priceDelta | INT | DEFAULT 0 | 加价（分） |
| sort | INT | DEFAULT 0 | 排序 |
| createdAt | DATETIME(3) | | |
| updatedAt | DATETIME(3) | | |

**索引：** `INDEX idx_group (groupId)`

### 2.7 order（订单）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 订单 ID |
| outTradeNo | VARCHAR(64) | NOT NULL, UNIQUE | 商户订单号 |
| merchantId | VARCHAR(32) | NOT NULL, FK→merchant.id | 所属门店 |
| openid | VARCHAR(64) | NOT NULL | 顾客 openid |
| status | VARCHAR(20) | NOT NULL | 订单状态（见 02-domain） |
| totalAmount | INT | NOT NULL | 总金额（分） |
| payMethod | VARCHAR(10) | NOT NULL | `wechat` / `on_site` |
| payStatus | VARCHAR(20) | NOT NULL DEFAULT 'unpaid' | 支付状态 |
| remark | VARCHAR(500) | | 订单备注 |
| createdAt | DATETIME(3) | NOT NULL | 下单时间 |
| paidAt | DATETIME(3) | | 支付时间 |
| acceptedAt | DATETIME(3) | | 接单时间 |
| completedAt | DATETIME(3) | | 完成时间 |
| cancelledAt | DATETIME(3) | | 取消时间 |
| cancelReason | VARCHAR(200) | | 取消原因 |

**索引：**
- `UNIQUE KEY uk_out_trade_no (outTradeNo)`
- `INDEX idx_merchant_status (merchantId, status, createdAt)`
- `INDEX idx_openid (openid, createdAt)`
- `INDEX idx_status (status)`

### 2.8 order_item（订单明细）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 明细 ID |
| orderId | VARCHAR(32) | NOT NULL, FK→order.id | 所属订单 |
| productId | VARCHAR(32) | NOT NULL | 商品 ID（仅追溯用，不做外键） |
| productName | VARCHAR(100) | NOT NULL | 商品名称快照 |
| productImage | VARCHAR(255) | | 商品图片快照 |
| price | INT | NOT NULL | 单价快照（分） |
| quantity | INT | NOT NULL | 数量 |
| specSnapshot | VARCHAR(500) | | 规格文本快照 |
| remark | VARCHAR(200) | | 单品备注 |
| subtotal | INT | NOT NULL | 小计（分） |
| createdAt | DATETIME(3) | | |

**索引：** `INDEX idx_order (orderId)`

**说明：** `productId` 不设外键，因为商品可能被删除，但历史订单明细需保留。

### 2.9 payment（支付流水）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 流水 ID |
| outTradeNo | VARCHAR(64) | NOT NULL, FK→order.outTradeNo | 商户订单号 |
| transactionId | VARCHAR(64) | | 微信交易号 |
| amount | INT | NOT NULL | 金额（分） |
| status | VARCHAR(20) | NOT NULL DEFAULT 'pending' | `pending`/`success`/`failed`/`refunded` |
| paidAt | DATETIME(3) | | 支付时间 |
| createdAt | DATETIME(3) | | |
| updatedAt | DATETIME(3) | | |

**索引：**
- `UNIQUE KEY uk_out_trade_no (outTradeNo)`
- `INDEX idx_transaction (transactionId)`

### 2.10 printer（打印机）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(32) | PK | 打印机 ID |
| merchantId | VARCHAR(32) | NOT NULL, FK→merchant.id | 所属门店 |
| name | VARCHAR(50) | NOT NULL | 打印机名称 |
| type | VARCHAR(20) | NOT NULL | 厂商类型 |
| sn | VARCHAR(100) | NOT NULL | 设备序列号 |
| createdAt | DATETIME(3) | | |
| updatedAt | DATETIME(3) | | |

**索引：** `INDEX idx_merchant (merchantId)`

### 2.11 user（顾客）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| openid | VARCHAR(64) | PK | 微信 openid |
| createdAt | DATETIME(3) | NOT NULL | 首次登录时间 |

## 3. ER 关系

```
merchant ──1:N──> category ──1:N──> product
merchant ──1:N──> product
merchant ──1:N──> spec_group ──1:N──> spec_option
product ──N:M──> spec_group  (product_spec_group)
merchant ──1:N──> order ──1:N──> order_item
merchant ──1:N──> printer
order ──1:1──> payment  (outTradeNo)
user ──1:N──> order  (openid)
```

## 4. 关键设计说明

1. **order_item 存快照**：`productName`、`productImage`、`price`、`specSnapshot` 均为快照，商家改菜单不影响历史订单展示。
2. **productId 不设外键**：商品删除后订单明细仍可正常读取。
3. **outTradeNo 唯一**：支付幂等的基础，重复回调通过唯一键拦截。
4. **库存字段在 product 表**：预扣走 Redis，正式扣减走 DB 乐观锁。
5. **订单不可物理删除**：仅状态流转，保证审计与退款可追溯。
