# v0.1.2 主链路联调接口变更（#12）

日期：2026-10-19
关联：`specs/02-domain.md` §4，`specs/03-api.md` §6.1 / §6.4 / §6.10，issue #12

跑通「扫码 → 菜单 → 加购 → 下单 → 支付 → 商家接单 → 完成 → 顾客确认取餐」时暴露的 7 处问题：
新增 1 个接口、扩展 2 处入参/错误码、修正 1 处响应结构，其余 3 处是不改变对外契约的实现与演示数据修复。

## 变更内容

| 位置 | 变更 | 原因 |
|---|---|---|
| `POST /api/v1/admin/orders/:id/confirm-payment` | 新增 | 到店支付订单创建后停在 `pending_payment`，此前没有任何接口能把它推进到 `pending_accept`，主链路走不到商家接单 |
| `GET /api/v1/admin/orders` | `status` 可选值新增 `pending_payment` | 商家需要按「待收款」筛出到店支付待确认的订单 |
| `POST /api/v1/orders` | 门店 `payOnSiteEnabled=false` 时选择 `on_site` 返回 `1001` | 该开关此前只存储不校验，顾客总能绕过微信支付 |
| `POST /api/v1/admin/orders/:id/cancel` 与顾客取消 | 取消时除 Redis `INCR` 外同步归还数据库 `stock`，并推送 `order:status` | 下单时 Redis 与 DB 各扣一次，取消只归还 Redis，库存永久泄漏；不推送则顾客端订单页停留在旧状态 |
| 下单预扣（实现修复） | `stock:pre:{productId}` 缺失时按 DB 库存 `SET NX` 初始化后再 `DECR` | 全新环境（Redis 无键）第一次下单必然 `DECR` 成负数返回 2001，模板开箱不可用 |
| §6.5 ~ §6.10 状态流转接口 | 响应的订单对象补上 `items`（`include: { items: true }`） | 顾客端订单详情页用流转响应直接 `setOrder`，缺 `items` 时 `order.items.map` 抛错整页白屏，确认取餐后看不到结果 |
| seed 演示数据 | 门店 `logo` 与商品 `image` 由假 CDN 地址改为 `null` | `https://cdn.example.com/*.png` 不可达，菜单页每次加载都产生 4 条网络错误；前端本就有占位块分支 |

## 兼容性

- 新增接口与新增枚举值，旧客户端不受影响。
- 取消订单的库存归还修复了少卖，不改变对外响应结构。
- 预扣初始化不改变对外响应，仅让首次下单从 `2001` 变为成功。
- 流转响应新增 `items` 字段是向后兼容的扩展；本仓库两端（后台、小程序）都按「响应即完整订单」渲染，改前小程序侧会崩溃。
