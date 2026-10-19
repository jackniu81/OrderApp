# 小程序

Taro 4 + React 18 + TypeScript 单店自提点餐顾客端。对应 specs/01-requirements.md P0 + Issue #10。

## 页面

| 路由 | 说明 |
|---|---|
| `pages/entry/index` | 扫码入口：scene → `/merchant/resolve`，失败可重试 |
| `pages/menu/index` | 分类 + 商品列表，下拉刷新，售罄/下架置灰 |
| `pages/confirm-order/index` | 购物车确认 + 备注 + 支付方式 + 下单 |
| `pages/orders/index` | 我的订单：全部/进行中两个 tab，触底分页 + 下拉刷新 |
| `pages/closed/index` | 打烊提示 + 公告 |
| `pages/order-detail/index` | 订单详情：状态进度条 + WS 实时刷新 + 确认取餐 |

弹窗组件：`SpecModal`（规格组选择）、`CartDrawer`（购物车）。
入口：菜单页左侧底部「我的订单」；下单成功后直接跳订单详情。

## 运行

后端需先起来（默认 `http://localhost:3000/api/v1`）：

```bash
docker-compose up -d          # Postgres + Redis
npm run migrate -w server
npm run seed -w server
npm run dev                   # NestJS
```

小程序端：

```bash
npm run miniapp:build         # weapp 产物 → dist/weapp，用微信开发者工具打开该目录
npm run dev:h5 -w miniapp     # H5 预览，http://localhost:10086（/api 代理到 3000）
npm run miniapp:typecheck
npm run miniapp:test
```

`project.config.json` 已关闭 urlCheck，可直接请求 localhost。

## 联调约定

- 服务端统一响应 `{ code, message, data }`，业务错误也是 HTTP 200 + 非 0 `code`（`BizExceptionFilter`），`services/request.ts` 据此抛 `ApiError`。
- 顾客标识用本地生成的 `customerId` 作为 openid（`utils/customer.ts`），正式小程序登录在 #12 联调阶段替换。
- 支付为沙箱模拟：服务端暂未返回 JSAPI `payParams`，`confirm-order` 在 weapp 下先尝试 `Taro.requestPayment`，失败后弹模拟支付框，再轮询 `/payment/:outTradeNo/status`。
- 订单状态实时刷新走 `ws://localhost:3000/ws`（`WsAdapter`，消息为 JSON `{ event, data }`）：客户端发 `subscribe:customer { openid }` 加入 `openid_<openid>` 房间，服务端推平铺的 `{ event: 'order:status', orderId, status, updatedAt }`。详情页同时保留 REST 拉取（进入/返回时刷新），WS 断开不影响可用性。
