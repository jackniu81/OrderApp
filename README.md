# OrderApp

单店自提点餐可复用模板（微信小程序 + 商家后台 + NestJS 服务端）。

> 第一版聚焦「远程下单 · 到店自提」场景，按多端标准编写，为后续支付宝/抖音端预留适配层。详细需求见 [`specs/`](./specs)。

## 架构总览

```
apps/miniapp   微信小程序（顾客端）
apps/admin     商家后台（Web）
server/        NestJS 服务端（REST + WebSocket + 微信支付回调）
  ├─ MySQL 8   业务数据持久化（Prisma ORM）
  └─ Redis 7   菜单缓存、库存预扣、WebSocket 广播
```

Monorepo 基于 npm workspaces（`apps/*` + `server`），本地依赖通过 `docker-compose` 拉起 MySQL 与 Redis。

## Tech Stack

### 服务端（`server/`）

| 类别 | 选型 | 用途 |
|---|---|---|
| 运行时 | Node.js ≥ 20 + TypeScript 5.6 | 类型安全 + 生态成熟 |
| 框架 | NestJS 10 | 模块化 DI、装饰器风格 Controller/Service |
| ORM | Prisma 5 | schema 即真相源，迁移与类型生成 |
| 数据库 | MySQL 8.0（utf8mb4） | 业务主数据存储 |
| 缓存 / 预扣 | Redis 7 + ioredis | 菜单缓存、库存原子 DECR/INCR、WS 广播 |
| 实时通信 | `@nestjs/platform-ws` + `ws` | 订单状态推送（< 3s） |
| 支付 | `wechatpay-node-v3` | 微信 JSAPI 下单、回调验签、幂等 |
| 认证 | `@nestjs/jwt` + `passport-jwt` + `bcrypt` | 顾客 openid token / 商家 admin token |
| 校验 | `class-validator` + `class-transformer` | DTO 入参校验 |
| 事件总线 | `@nestjs/event-emitter` | 模块间解耦（支付回调 → 订单状态机） |
| 测试 | Jest + ts-jest | 单元与集成测试（`server/src/**/*.spec.ts`） |
| 构建 | `nest build` + `tsc --noEmit` | CI 流水线类型检查 + 编译 |

### 前端

- **小程序端**（`apps/miniapp/`）：微信原生（规划中），通过 scene 参数解析门店入口。
- **商家后台**（`apps/admin/`）：Web 端管理菜单、订单、营业设置（规划中）。

### 基础设施

- 容器编排：`docker-compose.yml`（MySQL 8 + Redis 7，含健康检查与持久卷）。
- 配置：`.env` / `.env.example`（DB / Redis / JWT / 微信商户号等）。

## Key Features

### P0 已交付（v0.1）

- **F-01 入口识别**：扫码/链接解析 `scene` → 定位 `merchant_id`，打烊/非法 scene 友好降级。
- **F-02 菜单浏览**：分类切换、售罄置灰、上下架过滤；菜单读 Redis 缓存满足首屏 < 1s（NF-01）。
- **F-03 规格选择**：`single` / `multi` 规格组、可选必选、加价 `priceDelta` 实时计算。
- **F-04 购物车**：增减 / 删除 / 订单备注。
- **F-05 下单与支付**：
  - 下单预扣库存（Redis `DECR`），生成全局唯一 `out_trade_no`；
  - 微信 JSAPI 支付 + 回调验签；
  - **支付幂等**：唯一键 + 状态机拦截重复回调（NF-03）；
  - 到店支付兜底（`payOnSiteEnabled`）。
- **F-06 订单状态机**：`pending_payment → pending_accept → making → ready → completed`，旁支 `cancelled / refunding / refunded`，非法转换统一返回错误码 `2002`（实现见 [`server/src/order/state-machine.ts`](./server/src/order/state-machine.ts)）。
- **F-07 商家端订单管理**：新单 WebSocket 提醒、接单 / 完成 / 取消 / 退款、小票打印（飞鹅 / 芯烨 / 商米）。
- **F-08 菜单管理**：分类、商品、规格组与选项的 CRUD 与上下架、库存调整。
- **F-09 营业设置**：营业 / 打烊切换、门店公告。

### 关键设计

- **预扣 + 超时释放**：15 分钟未支付自动 `INCR` 回滚，数据库层 CAS 乐观锁兜底防超卖（NF-04）。
- **订单快照**：`order_item` 存 `productName / productImage / price / specSnapshot`，菜单变更不影响历史订单。
- **金额一律以「分」存储**：避免浮点误差，前后端契约一致。
- **WebSocket 推送**：顾客端订阅 `openid` 房间、商家端订阅 `merchantId` 房间；心跳 30s，超时 60s 重连。
- **统一响应结构**：`{ code, message, data }`，业务错误码集中定义（`1001 ~ 9999`，见 [`specs/03-api.md`](./specs/03-api.md#15-错误码)）。

### 后续规划

- **P1**：堂食桌台、加菜催单、热销榜与搜索、营业数据看板、店员权限分离、分单打印。
- **P2**：会员/积分/优惠券、多门店与连锁看板、抖音 / 支付宝端。

## 快速开始

```powershell
# 1. 启动依赖（MySQL + Redis）
docker compose up -d

# 2. 安装依赖（npm workspaces）
npm install

# 3. 配置环境变量
copy .env.example .env

# 4. 数据库迁移与种子
cd server
npm run migrate
npm run seed

# 5. 启动服务端
cd ..
npm run dev
```

服务端默认运行于 `http://localhost:3000`，API 前缀 `/api/v1`；WebSocket 端点 `/ws`，客户端通过 `subscribe:customer { openid }` / `subscribe:merchant { merchantId }` 加入对应房间。

## 测试

```powershell
npm run ci -w server   # tsc 类型检查 + nest build + jest
```

## 文档索引

| 文档 | 内容 |
|---|---|
| [`specs/01-requirements.md`](./specs/01-requirements.md) | 需求规格与 P0/P1/P2 分级、验收用例、非功能指标 |
| [`specs/02-domain.md`](./specs/02-domain.md) | 领域对象、关系图、订单状态机、库存机制 |
| [`specs/03-api.md`](./specs/03-api.md) | REST 接口契约、错误码、WebSocket 事件 |
| [`specs/04-data.md`](./specs/04-data.md) | 表结构、索引、ER 关系、关键设计说明 |

## License

见 [`LICENSE`](./LICENSE)。
