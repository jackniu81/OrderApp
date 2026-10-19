# 部署手册（单机 docker-compose）

面向「一家门店自提点餐」的单机交付：一台 Linux 虚拟机（2C4G 起步即可）跑全套。
本文所有命令都在**仓库根目录**执行，Windows PowerShell 与 Linux bash 通用（PowerShell 不支持 `&&`，请拆成两行或用 `;`）。

相关仓库文件：

| 文件 | 作用 |
|---|---|
| `docker-compose.prod.yml` | 生产编排：MySQL + Redis + 一次性迁移 + NestJS 服务端 + Nginx 后台 |
| `.deploy.env.example` | 环境变量模板，复制为 `.deploy.env` 后填写（已被 `.gitignore` 忽略） |
| `deploy/Dockerfile.server` | 服务端镜像（多阶段：`npm ci` → `prisma generate` → `nest build` → 运行期） |
| `deploy/Dockerfile.admin` | 后台镜像（Vite 构建产物 + Nginx） |
| `deploy/nginx.conf` | 静态资源 + `/api/` 与 `/ws` 反向代理 |
| `.dockerignore` | 构建上下文排除项，**必须包含 `**/.env`**（见「安全检查清单」） |

## 1. 拓扑

```
              ┌──────────────┐
  浏览器/微信 │   Nginx :80  │  静态资源（商家后台 SPA）
 ─────────────►              │
              │  /api/ ──┐   │
              │  /ws   ──┼───┼──► server :3000  NestJS（REST + WebSocket）
              └──────────┼───┘          │
                         │              ├──► mysql :3306（业务数据，仅绑 127.0.0.1）
                         │              └──► redis :6379（菜单缓存 / 库存预扣，仅绑 127.0.0.1）
                         └── 顾客端小程序直连 https://<域名>/api/v1
```

- 对外只暴露 Nginx 的 80（或 443）端口；`server` 只在 docker 内部网络可达。
- MySQL / Redis 端口映射到 `127.0.0.1`，方便同机 `mysqldump` 备份，不对公网开放。
- 数据库结构由 `server/prisma/migrations/` 里已提交的迁移决定，启动前由一次性 `migrate` 服务应用。

## 2. 前置条件

- Docker 24+ 与 Docker Compose v2.20+（`migrate` 用了 `service_completed_successfully` 条件，旧版 compose 不支持）。
- 一个解析到这台机器的域名（顾客端小程序要求 HTTPS 域名白名单；纯 IP 只能在开发者工具里勾「不校验合法域名」调试）。
- 服务器上不需要安装 Node——构建全部在镜像内完成。

## 3. 部署步骤

### 3.1 拉代码并准备环境变量

```bash
git clone <仓库地址> orderapp && cd orderapp
cp .deploy.env.example .deploy.env
```

编辑 `.deploy.env`，**必须改的三项**：

```bash
# 1) 数据库 root 密码（仅容器网络内使用，但别用弱口令）
DB_ROOT_PASSWORD=<强随机密码>
# 2) Redis 密码（生产 compose 已开启 requirepass）
REDIS_PASSWORD=<强随机密码>
# 3) JWT 密钥，必须 ≥32 位随机串
JWT_SECRET=$(openssl rand -hex 32)
```

生成密码：`openssl rand -base64 24`。`JWT_SECRET` 变更后所有已登录的后台会话与顾客端 token 全部失效，属正常现象。

### 3.2 构建并启动

```bash
docker compose --env-file .deploy.env -f docker-compose.prod.yml up -d --build
```

首次构建约 3~6 分钟（镜像内要 `npm ci` 整个 monorepo）。启动顺序由健康检查串起来：

1. `mysql` / `redis` healthy；
2. `migrate` 一次性容器执行 `prisma migrate deploy`，成功后退出；
3. `server` 启动并通过 `/api/v1/merchant/resolve` 探活；
4. `admin`（Nginx）对外提供 80。

查看状态与日志：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f server
```

### 3.3 初始化演示数据（可选，正式门店跳过）

```bash
docker compose --env-file .deploy.env -f docker-compose.prod.yml run --rm server npx tsx prisma/seed.ts
```

seed 幂等：库里已有门店就跳过并提示重置命令，不会注入第二份数据。执行完记下输出的**门店 ID**与**扫码 scene**（base64），生成桌码要在后台「菜单管理」里对照。

后台账号 `admin / admin123` 由 seed 创建（密码 bcrypt 存储）。正式门店上线时：跑一次 seed 拿到这个账号，录入自己的菜单后，**务必改掉默认口令**——当前版本没有独立的建号 / 改密接口，可以直接更新数据库：

```bash
# 生成 bcrypt 哈希（容器里跑，避免本机装依赖）
docker compose -f docker-compose.prod.yml --env-file .deploy.env run --rm server \
  node -e "console.log(require('bcrypt').hashSync(process.argv[1],10))" '<新密码>'

docker exec order-mysql mysql -uroot -p"$DB_ROOT_PASSWORD" \
  -e "UPDATE orderapp.admin_user SET password='<上一步输出的哈希>' WHERE username='admin';"
```

### 3.4 验证清单

| 检查 | 命令 | 期望 |
|---|---|---|
| 后台可访问 | `curl -I http://<域名>/` | `200`，`content-type: text/html` |
| 前端资源代理正常 | 浏览器打开后台并登录 | 进入工作台，控制台无报错 |
| API 经 Nginx 可达 | `curl -X POST http://<域名>/api/v1/auth/admin-login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'` | `{"code":0,...,"token":"..."}` |
| WebSocket 经 Nginx 可达 | 后台订单页保持打开，另开终端下一张到店支付单并在后台点「确认收款」 | 右下角弹出「收到新订单」 |
| 迁移已应用 | `docker compose -f docker-compose.prod.yml run --rm server npx prisma migrate status` | `Database schema is up to date!` |

WebSocket 这一步最容易踩坑：Nginx 的 `/ws` 必须带 `Upgrade`/`Connection` 头且 `proxy_read_timeout` 大于 30s 心跳，否则表现为「新单不提醒、约 60s 后重连一次」。仓库里的 `deploy/nginx.conf` 已按此配好。

## 4. 环境变量清单

`docker-compose.prod.yml` 通过 `${VAR}` 从 `.deploy.env` 插值，容器内实际注入的是下面这些：

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `DB_ROOT_PASSWORD` | 是 | — | compose 插值用，同时拼进 `DATABASE_URL` |
| `DB_NAME` | 否 | `orderapp` | 数据库名 |
| `REDIS_PASSWORD` | 是 | — | Redis `requirepass` |
| `JWT_SECRET` | 是 | — | 签名密钥，≥32 位随机 |
| `JWT_EXPIRES_IN` | 否 | `7d` | token 有效期 |
| `HTTP_PORT` | 否 | `80` | Nginx 对外端口 |
| `WX_APPID` / `WX_APPSECRET` | 上线必填 | 空 | 顾客端 openid 登录；留空时顾客端用本地生成的 `openid` |
| `WX_PAY_MCH_ID` / `WX_PAY_API_V3_KEY` / `WX_PAY_PRIVATE_KEY_PATH` / `WX_PAY_CERT_PATH` / `WX_PAY_NOTIFY_URL` | 上线必填 | 空 | 微信支付 V3；未配置时下单走「模拟支付」沙箱 |
| `DEFAULT_PAY_ON_SITE_ENABLED` | 否 | `true` | 门店默认是否允许到店支付 |

> 证书路径 `WX_PAY_PRIVATE_KEY_PATH` / `WX_PAY_CERT_PATH` 是**容器内路径**，需要把证书文件挂载进 `server` 容器（例如 `- ./certs:/repo/server/certs:ro`），不要把证书提交进仓库。

## 5. HTTPS 与微信小程序

微信小程序的 `request` / `socket` 合法域名要求 **HTTPS + WSS + 已备案域名**，因此生产必须在 Nginx 前面再套一层 TLS。两种做法：

**A. 用 Caddy 反代（自动签发证书，最省事）**

```bash
caddy reverse-proxy --from order.example.com --to localhost:10088
```

并把 `.deploy.env` 的 `HTTP_PORT` 指到 Caddy 能到达的端口。Caddy 会自动透传 `Upgrade` 头。

**B. 自己给 Nginx 加证书**

在 `deploy/nginx.conf` 的 `server` 块里加 `listen 443 ssl;` 与证书路径，80 端口只做 301 跳转。注意 WSS 依赖同一个 `/ws` location，证书链不完整时表现为浏览器能连、小程序连不上。

然后在微信公众平台「开发设置 → 服务器域名」里把 `https://order.example.com` 加进 request 合法域名、`wss://order.example.com/ws` 加进 socket 合法域名。

## 6. 升级发布

```bash
git pull
docker compose --env-file .deploy.env -f docker-compose.prod.yml up -d --build
```

`up -d --build` 会重建镜像、重跑 `migrate`（无新迁移时是 no-op），再滚动替换 `server` 与 `admin`。停机时间约等于 Nest 启动的 3~5 秒。

**破坏性迁移（删列 / 改类型）前先备份**（见第 7 节），并考虑手动分两步：

```bash
docker compose -f docker-compose.prod.yml --env-file .deploy.env run --rm server npx prisma migrate deploy   # 只迁移
docker compose -f docker-compose.prod.yml --env-file .deploy.env up -d server admin                          # 只换应用
```

## 7. 备份与恢复

```bash
# 备份（建议 crontab 每天一次，保留 7 天）
docker exec order-mysql mysqldump -uroot -p"$DB_ROOT_PASSWORD" --single-transaction --routines orderapp \
  | gzip > backup-orderapp-$(date +%F).sql.gz

# Redis 是缓存 + 预扣计数，AOF 已开启（appendonly yes），持久卷在 redis_data
docker run --rm -v orderapp-cli_redis_data:/data alpine tar czf - /data > backup-redis-$(date +%F).tar.gz
```

恢复：

```bash
gunzip -c backup-orderapp-2026-10-19.sql.gz | docker exec -i order-mysql mysql -uroot -p"$DB_ROOT_PASSWORD" orderapp
```

> ⚠️ 恢复数据库后**必须同时清掉 Redis 的库存预扣镜像**，否则 Redis 与 DB 库存不一致，会持续出现「明明有货却报 2001」：
> ```bash
> docker exec order-redis redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'stock:pre:*' | xargs -r docker exec -i order-redis redis-cli -a "$REDIS_PASSWORD" del
> ```
> 预扣键缺失时下单会按 DB 库存重新初始化，所以删除是安全的。

## 8. 回滚

应用层：给每次发布的镜像打不可变 tag，回滚只需换 tag 重启。

```bash
docker tag orderapp-server:latest orderapp-server:2026-10-19
# 回滚
docker compose -f docker-compose.prod.yml --env-file .deploy.env up -d --no-build server   # 先把 image 改成 orderapp-server:2026-10-19
```

数据层：Prisma 迁移**不能自动回滚**（`migrate rollback` 不存在）。回滚数据库只能靠第 7 节的备份恢复，所以破坏性迁移务必先备份、并在低峰期执行。

## 9. 故障排查

| 现象 | 定位 | 处理 |
|---|---|---|
| `migrate` 容器退出码非 0，`server` 不起 | `logs migrate` | 若是连不上库：`mysql` 健康检查未过，等它 healthy 后 `up -d` 重来 |
| `Error: Could not parse schema engine response` / Prisma 引擎加载失败 | 基础镜像 | Alpine(musl) + OpenSSL 3 上 Prisma 5 引擎不稳定，服务端镜像必须用 Debian slim（本仓库已改） |
| `nest build` 报大量 `TS7006 implicitly has an 'any' type` | 镜像构建顺序 | `prisma generate` 必须早于 `nest build`，否则 Prisma 类型缺失 |
| 后台能打开但接口 502 | `logs server` | Nest 没起来，通常是 `DATABASE_URL`/`REDIS_URL` 写错 |
| 新订单不提醒，控制台 WS 反复重连 | `logs admin` / Nginx | `/ws` 少了 `Upgrade` 透传或 `proxy_read_timeout` 太短 |
| 下单报 `2001 库存不足` 但后台显示有货 | Redis 与 DB 不一致 | 删掉 `stock:pre:*` 让镜像重建（第 7 节的命令） |
| 订单时间差 8 小时 | 时区 | MySQL 容器已设 `TZ=Asia/Shanghai`；自建库需确认 `@@time_zone` |
| 顾客端进店提示「入口参数无效」 | scene 参数 | scene 必须是 base64（`bWVyY2hhbnRfaWQ9...`），裸 `merchant_id=xxx` 会被 URL 查询解析截断 |
| 镜像拉取超时 `auth.docker.io` | 网络/DNS | 换镜像加速器或重试；本仓库构建过程无自定义源依赖 |

## 10. 安全检查清单（上线前逐条确认）

- [ ] **`POST /api/v1/payment/wx-notify` 未做 V3 签名验证**（当前实现只按 `out_trade_no` 幂等推进状态）。任何知道订单号的人都能把订单标记为已支付。上线前必须接入 `wechatpay-node-v3` 的回调验签 + AAD 解密，或至少在网关侧限制该路径来源。**这是本版本最大的已知风险。**
- [ ] 菜单管理的 `PUT/DELETE /admin/categories/:id`、`/admin/products/:id`、`/admin/spec-groups/:id` 只校验了请求体/查询里的 `merchantId`，未按 `:id` 反查归属门店，存在跨门店改数据的越权风险。上线前应补服务端按资源 ID 的归属校验。
- [ ] `JWT_SECRET` 已换成随机值，未使用示例值；`.deploy.env` 未提交进仓库。
- [ ] 默认后台账号 `admin / admin123` 已改密（正式门店务必改）。
- [ ] MySQL / Redis 只绑在 `127.0.0.1`，公网安全组不放行 3306/6379。
- [ ] `.dockerignore` 含 `**/.env`：否则宿主机的 `server/.env` 会被 `COPY . .` 烤进镜像层，任何能 `docker save` 的人都拿得到密钥。
- [ ] 微信支付证书目录以只读方式挂载，未进仓库。
- [ ] HTTPS 已启用，后台登录 cookie/token 不走明文 HTTP。

## 11. 已知限制（交付时需向门店说明）

- **超时未支付订单不会自动取消**：预扣 Redis 键有 15 分钟 TTL，到期后按 DB 库存重新初始化，但订单本身长期停在 `pending_payment`，占用的 DB 库存不会自动归还。需要自动释放（含与支付回调的竞态处理）作为后续迭代。
- **已支付订单取消不自动退款**：`OrderService.cancel()` 只记日志并留 `TODO`，退款需接 `PaymentService.refund`。当前运营做法是线下退。
- **顾客身份是本地生成的 `openid`**，未走微信 `code2session`。真实小程序登录需要 AppID/AppSecret 与后端换取 openid。
- **体验版小程序二维码**依赖真实 AppID 与已认证主体，无法随仓库分发，需在微信开发者工具里上传后由公众平台生成（步骤见 `README.md`）。
- **打印小票**依赖门店自己的飞鹅/芯烨/商米账号，需在后台「打印机配置」里填 key 并在服务端配置对应凭据。

---

返回 [README](../README.md) · 接口契约见 [specs/03-api.md](../specs/03-api.md)
