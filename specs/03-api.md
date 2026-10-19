# 03 - 接口契约（API）

> 本文档定义前后端接口契约。所有接口以本文档为准；变更需同步更新本文档并在 `specs/changes/` 留记录。

## 1. 通用约定

### 1.1 基础信息

- Base URL: `/api/v1`
- 数据格式：`application/json; charset=utf-8`
- 时间格式：ISO 8601（如 `2026-10-17T10:30:00+08:00`）
- 金额单位：**分**（整数），避免浮点误差

### 1.2 统一响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

- `code`: 0 表示成功，非 0 表示业务错误
- `message`: 错误描述（成功时为 "ok"）
- `data`: 业务数据

### 1.3 认证

- 顾客端：通过 `Authorization: Bearer <openid_token>` 头传递，token 由微信登录换取
- 商家端：通过 `Authorization: Bearer <admin_token>` 头传递
- 未登录或 token 失效返回 `401`
- 商家端接口若在 query 或 body 中显式携带 `merchantId`，必须与 token 所属门店一致，否则返回 `1003`；路径参数形式的资源 ID（订单、打印机等）在服务层校验归属，跨门店按 `1003`（订单）或 `1004`（打印机，不暴露资源是否存在）拒绝

### 1.4 分页

列表接口统一使用 `page` 和 `pageSize` 参数：

```
GET /api/v1/orders?page=1&pageSize=20
```

响应：

```json
{
  "code": 0,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 1.5 错误码

| code | HTTP | 含义 |
|---|---|---|
| 0 | 200 | 成功 |
| 1001 | 400 | 参数错误 |
| 1002 | 401 | 未登录或 token 失效 |
| 1003 | 403 | 无权限 |
| 1004 | 404 | 资源不存在 |
| 2001 | 409 | 库存不足 |
| 2002 | 409 | 订单状态不允许此操作 |
| 2003 | 409 | 商品已下架 |
| 3001 | 500 | 支付失败 |
| 3002 | 502 | 支付回调验签失败 |
| 4001 | 503 | 打印机离线 |
| 5001 | 429 | 请求过于频繁 |
| 9999 | 500 | 服务器内部错误 |

---

## 2. 认证模块 `/auth`

### 2.1 微信小程序登录

`POST /api/v1/auth/wx-login`

**Request:**

```json
{
  "code": "wx_login_code"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "token": "openid_token",
    "openid": "oXXXX",
    "isNew": true
  }
}
```

### 2.2 商家后台登录

`POST /api/v1/auth/admin-login`

**Request:**

```json
{
  "username": "admin",
  "password": "***"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "token": "admin_token",
    "merchantId": "m001",
    "role": "owner"
  }
}
```

---

## 3. 门店模块 `/merchant`

### 3.1 解析 scene 识别门店

`GET /api/v1/merchant/resolve?scene=xxx`

> 顾客通过小程序入口（扫码或链接）进入时调用，解析 scene 获取门店信息。

**Response:**

```json
{
  "code": 0,
  "data": {
    "merchantId": "m001",
    "merchantName": "示例奶茶店",
    "logo": "https://cdn.example.com/logo.png",
    "isOpen": true,
    "notice": "今日新品上市"
  }
}
```

**错误码：** scene 无效返回 `1004`，门店打烊返回门店信息且 `isOpen: false`。

### 3.2 获取门店信息（含营业状态）

`GET /api/v1/merchant/:id`

**Response:**

```json
{
  "code": 0,
  "data": {
    "id": "m001",
    "name": "示例奶茶店",
    "logo": "https://cdn.example.com/logo.png",
    "address": "XX路XX号",
    "phone": "13800138000",
    "businessHours": "09:00-22:00",
    "isOpen": true,
    "payOnSiteEnabled": true,
    "notice": "今日新品上市"
  }
}
```

### 3.3 更新门店设置（商家端）

`PUT /api/v1/merchant/:id`

**Request:**

```json
{
  "name": "示例奶茶店",
  "businessHours": "09:00-22:00",
  "isOpen": true,
  "payOnSiteEnabled": true,
  "notice": "今日新品上市"
}
```

---

## 4. 菜单模块 `/menu`

### 4.1 获取菜单（顾客端，含分类与商品）

`GET /api/v1/menu?merchantId=m001`

> 此接口走缓存，首屏优先读缓存。

**Response:**

```json
{
  "code": 0,
  "data": {
    "categories": [
      {
        "id": "c001",
        "name": "招牌奶茶",
        "sort": 1,
        "visible": true,
        "products": [
          {
            "id": "p001",
            "name": "珍珠奶茶",
            "image": "https://cdn.example.com/p001.png",
            "price": 1500,
            "stock": 50,
            "soldOut": false,
            "onSale": true,
            "specGroupIds": ["g001", "g002"]
          }
        ]
      }
    ]
  }
}
```

### 4.2 商品详情（含规格）

`GET /api/v1/products/:id`

**Response:**

```json
{
  "code": 0,
  "data": {
    "id": "p001",
    "name": "珍珠奶茶",
    "description": "经典珍珠奶茶",
    "image": "https://cdn.example.com/p001.png",
    "price": 1500,
    "stock": 50,
    "soldOut": false,
    "onSale": true,
    "categoryId": "c001",
    "specGroups": [
      {
        "id": "g001",
        "name": "杯型",
        "type": "single",
        "required": true,
        "options": [
          { "id": "o001", "name": "中杯", "priceDelta": 0 },
          { "id": "o002", "name": "大杯", "priceDelta": 300 }
        ]
      },
      {
        "id": "g002",
        "name": "加料",
        "type": "multi",
        "required": false,
        "options": [
          { "id": "o003", "name": "珍珠", "priceDelta": 200 },
          { "id": "o004", "name": "椰果", "priceDelta": 200 }
        ]
      }
    ]
  }
}
```

---

## 5. 菜单管理模块（商家端）`/admin`

### 5.1 分类管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/categories?merchantId=m001` | 分类列表 |
| POST | `/api/v1/admin/categories` | 新增分类 |
| PUT | `/api/v1/admin/categories/:id` | 编辑分类 |
| DELETE | `/api/v1/admin/categories/:id` | 删除分类 |

**分类对象：**

```json
{
  "id": "c001",
  "merchantId": "m001",
  "name": "招牌奶茶",
  "sort": 1,
  "visible": true
}
```

### 5.2 商品管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/products?merchantId=m001` | 商品列表 |
| POST | `/api/v1/admin/products` | 新增商品 |
| PUT | `/api/v1/admin/products/:id` | 编辑商品 |
| DELETE | `/api/v1/admin/products/:id` | 删除商品 |
| PATCH | `/api/v1/admin/products/:id/stock` | 调整库存 |
| PATCH | `/api/v1/admin/products/:id/sale` | 上下架 |

**商品对象：**

```json
{
  "id": "p001",
  "merchantId": "m001",
  "categoryId": "c001",
  "name": "珍珠奶茶",
  "description": "经典珍珠奶茶",
  "image": "https://cdn.example.com/p001.png",
  "price": 1500,
  "stock": 50,
  "onSale": true,
  "specGroupIds": ["g001", "g002"]
}
```

**调整库存 Request:**

```json
{ "stock": 100 }
```

**上下架 Request:**

```json
{ "onSale": false }
```

### 5.3 规格组管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/spec-groups?merchantId=m001` | 规格组列表 |
| POST | `/api/v1/admin/spec-groups` | 新增规格组（含选项） |
| PUT | `/api/v1/admin/spec-groups/:id` | 编辑规格组 |
| DELETE | `/api/v1/admin/spec-groups/:id` | 删除规格组 |

**规格组对象：**

```json
{
  "id": "g001",
  "merchantId": "m001",
  "name": "杯型",
  "type": "single",
  "required": true,
  "options": [
    { "id": "o001", "name": "中杯", "priceDelta": 0 },
    { "id": "o002", "name": "大杯", "priceDelta": 300 }
  ]
}
```

`type`: `single`（单选）或 `multi`（多选）。

---

## 6. 订单模块 `/orders`

### 6.1 创建订单

`POST /api/v1/orders`

**Request:**

```json
{
  "merchantId": "m001",
  "items": [
    {
      "productId": "p001",
      "quantity": 2,
      "specs": [
        { "groupId": "g001", "optionId": "o002" },
        { "groupId": "g002", "optionIds": ["o003"] }
      ],
      "remark": "少糖"
    }
  ],
  "remark": "不要香菜",
  "payMethod": "wechat"
}
```

`payMethod`: `wechat`（微信支付）或 `on_site`（到店支付）。

**Response:**

```json
{
  "code": 0,
  "data": {
    "orderId": "ord_20261017_0001",
    "outTradeNo": "m001_20261017103000_0001",
    "totalAmount": 3600,
    "status": "pending_payment",
    "payParams": {
      "timeStamp": "1760688600",
      "nonceStr": "xxx",
      "package": "prepay_id=xxx",
      "signType": "RSA",
      "paySign": "xxx"
    }
  }
}
```

到店支付时 `payParams` 为 `null`，`status` 为 `pending_payment`（到店）。

**错误码：** 库存不足返回 `2001`，商品已下架返回 `2003`，门店未开启到店支付而选择 `on_site` 返回 `1001`。

### 6.2 查询订单详情

`GET /api/v1/orders/:id`

**Response:**

```json
{
  "code": 0,
  "data": {
    "id": "ord_20261017_0001",
    "merchantId": "m001",
    "status": "making",
    "totalAmount": 3600,
    "payMethod": "wechat",
    "payStatus": "paid",
    "remark": "不要香菜",
    "items": [
      {
        "id": "oi001",
        "productId": "p001",
        "productName": "珍珠奶茶",
        "productImage": "https://cdn.example.com/p001.png",
        "price": 1500,
        "quantity": 2,
        "specSnapshot": "大杯 / 加料：珍珠",
        "remark": "少糖",
        "subtotal": 3600
      }
    ],
    "createdAt": "2026-10-17T10:30:00+08:00",
    "paidAt": "2026-10-17T10:30:15+08:00",
    "acceptedAt": "2026-10-17T10:31:00+08:00",
    "completedAt": null
  }
}
```

### 6.3 顾客订单列表

`GET /api/v1/orders?page=1&pageSize=20`

> 仅返回当前登录顾客的订单。

### 6.4 商家订单列表

`GET /api/v1/admin/orders?merchantId=m001&status=pending_accept&page=1&pageSize=20`

`status` 可选：`pending_payment`、`pending_accept`、`making`、`ready`、`completed`、`cancelled`、`refunding`、`refunded`。不传则返回全部。

**商家订单详情**

`GET /api/v1/admin/orders/:id`

返回订单及其 `items`（含规格快照），仅允许查询本门店订单：其他门店的订单返回 `1003`，不存在返回 `1004`。

### 6.5 商家接单

`POST /api/v1/admin/orders/:id/accept`

**Response:** 成功返回 `code: 0`，订单状态变为 `making`。
**错误码：** 状态不允许返回 `2002`。

> §6.5 ~ §6.10 的状态流转接口统一返回流转后的订单对象，且**必定带 `items`**（与 §6.4 详情一致）。客户端拿到响应可直接渲染，无需再查一次详情。

### 6.6 商家完成订单

`POST /api/v1/admin/orders/:id/complete`

**Response:** 成功返回 `code: 0`，订单状态变为 `ready`（可取餐）。
**错误码：** 状态不允许返回 `2002`。

### 6.7 商家取消订单

`POST /api/v1/admin/orders/:id/cancel`

**Request:**

```json
{ "reason": "门店打烊" }
```

**Response:** 成功返回 `code: 0`，订单状态变为 `cancelled`，已支付订单自动发起退款。
**错误码：** 状态不允许返回 `2002`。

### 6.8 顾客取消订单

`POST /api/v1/orders/:id/cancel`

> 仅待接单（`pending_accept`）状态的订单可取消。已支付的自动退款。

**Request:**

```json
{ "reason": "不想吃了" }
```

### 6.9 确认完成（顾客取餐后）

`POST /api/v1/orders/:id/finish`

> 顾客或商家均可调用，订单状态从 `ready` 变为 `completed`。

### 6.10 商家确认到店收款

`POST /api/v1/admin/orders/:id/confirm-payment`

> 顾客选择到店支付时订单停在 `pending_payment`（`payMethod = on_site`），顾客到店付现后由商家调用本接口确认，效果等价于微信支付成功：状态转 `pending_accept`、`payStatus` 置 `paid`，并向商家房间推送 `order:new`、向顾客房间推送 `order:status`。

**Response:** 成功返回 `code: 0`，订单状态变为 `pending_accept`。
**错误码：** 非 `on_site` 订单返回 `2002`；状态不允许（如已接单）返回 `2002`；其他门店订单返回 `1003`。

---

## 7. 支付模块 `/payment`

### 7.1 微信支付回调

`POST /api/v1/payment/wx-notify`

> 微信支付服务器回调，需验签。处理成功返回 XML 格式的成功响应。

**Request（微信原始 XML）:**

```xml
<xml>
  <out_trade_no>m001_20261017103000_0001</out_trade_no>
  <transaction_id>4200000000000000000000</transaction_id>
  <total_fee>3600</total_fee>
  <result_code>SUCCESS</result_code>
  ...
</xml>
```

**幂等要求：** 同一 `out_trade_no` 的回调只处理一次，重复回调返回成功响应但不重复变更订单状态。

### 7.2 查询支付状态

`GET /api/v1/payment/:outTradeNo/status`

**Response:**

```json
{
  "code": 0,
  "data": {
    "outTradeNo": "m001_20261017103000_0001",
    "status": "paid",
    "transactionId": "4200000000000000000000",
    "paidAt": "2026-10-17T10:30:15+08:00"
  }
}
```

---

## 8. 打印模块 `/printer`

### 8.1 打印机列表（商家端）

`GET /api/v1/admin/printers?merchantId=m001`

**Response:**

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "pr001",
        "name": "前台打印机",
        "type": "feie",
        "sn": "xxxxxx",
        "online": true,
        "createdAt": "2026-10-17T10:00:00+08:00"
      }
    ]
  }
}
```

### 8.2 添加打印机（商家端）

`POST /api/v1/admin/printers`

**Request:**

```json
{
  "merchantId": "m001",
  "name": "前台打印机",
  "type": "feie",
  "sn": "xxxxxx"
}
```

`type` 可选：`feie`、`xprinter`、`sunmi`；同门店重复 `sn` 返回 `1001`。

### 8.2.1 删除打印机（商家端）

`DELETE /api/v1/admin/printers/:id`

**错误码：** 不属于本门店或不存在返回 `1004`。

### 8.3 打印小票

`POST /api/v1/admin/orders/:id/print`

**Request（可选）：**

```json
{ "printerId": "pr001" }
```

不传 `printerId` 时按添加顺序使用门店第一台打印机。

**Response:**

```json
{
  "code": 0,
  "data": { "printId": "prt_001" }
}
```

**错误码：** 打印机离线或未配置返回 `4001`；指定打印机不属于本门店返回 `4001`。

---

## 9. WebSocket 事件

### 9.1 连接

统一连接 `wss://api.example.com/ws`（不带 token 参数），连接后由客户端发送订阅消息进入对应房间：

- 顾客端：`{ "event": "subscribe:customer", "data": { "openid": "oX" } }` → 房间 `openid_oX`
- 商家端：`{ "event": "subscribe:merchant", "data": { "merchantId": "m001" } }` → 房间 `merchant_m001`

服务端订阅成功后回 `{ "event": "subscribed", "room": "..." }`。

### 9.2 事件列表

| 事件名 | 方向 | 负载 | 说明 |
|---|---|---|---|
| `order:new` | S→商家端 | `{ orderId, items, totalAmount }` | 新订单提醒（支付成功回调处理完成后推送） |
| `order:status` | S→顾客端 | `{ orderId, status, updatedAt }` | 订单状态变更 |
| `order:status` | S→商家端 | `{ orderId, status, updatedAt }` | 订单状态变更 |
| `ping` | C→S | `{}` | 心跳 |
| `pong` | S→C | `{}` | 心跳响应 |

### 9.3 心跳与重连

- 客户端每 30s 发送 `ping`，服务端回复 `pong`
- 超过 60s 未收到 `pong` 则断线重连
- 重连后需重新订阅订单房间

---

## 10. 接口变更记录

> 每次接口变更需在此追加记录，并在 `specs/changes/` 提交详细说明。

| 日期 | 版本 | 变更内容 |
|---|---|---|
| 2026-10-17 | v0.1.0 | 初版接口定义（仅自提，无桌台） |
| 2026-10-19 | v0.1.1 | 商家后台（#11）：新增商家订单详情 `GET /admin/orders/:id`、删除打印机 `DELETE /admin/printers/:id`、打印小票支持可选 `printerId`；明确商家端接口跨门店访问的拒绝方式（见 specs/changes/2026-10-19-admin-issue11.md）；§9.1 连接方式按实现修订为统一 `/ws` + 订阅消息 |
| 2026-10-19 | v0.1.2 | 主链路联调（#12）：新增到店收款确认 `POST /admin/orders/:id/confirm-payment`、商家订单列表 `status` 支持 `pending_payment`、`on_site` 下单校验门店开关、取消订单归还数据库库存（见 specs/changes/2026-10-19-integration-issue12.md） |
