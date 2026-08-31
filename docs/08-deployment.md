# 08 · 部署、升级与备份策略

> 本文档定义 juece-grow 的部署形态、升级安全与备份/恢复口径。原则遵循 AGENTS.md：
> 内容数据不丢失、配置不被覆盖、schema 变更禁止破坏性改表。

## 1. 部署形态

生产拆三段，各自独立、可分布在任意主机：

| 组件                            | 形态      | 运行                                                                     |
| ----------------------------- | ------- | ---------------------------------------------------------------------- |
| Payload CMS + admin + /api/v2 | Node 进程 | `pnpm cms:build` → `.next/standalone` 或 `next start`，端口 3000           |
| 公开站 Astro                     | 纯静态产物   | `pnpm astro:build` → `dist/`，交给 Nginx/CDN                              |
| PostgreSQL（juece\_grow）       | 服务器原生   | 服务器本机 PostgreSQL 服务，绑定 `127.0.0.1`，仅 CMS 使用                            |
| Chatwoot（应用 + Redis 容器）       | 应用容器    | `docker compose -f docker-compose.prod.yml up -d`；其 Postgres 指向服务器原生实例 |

生产原则：**数据库一律使用服务器原生 PostgreSQL，禁止用容器承载生产数据**。
根 `docker-compose.yml` 仅用于本地开发/测试（容器 Postgres 5434）；生产不部署该套。
容器只承载 Chatwoot 应用进程与 Redis（缓存/队列）；CMS 与公开站跑宿主进程。

### 生产数据库（服务器原生 PostgreSQL）

服务器安装原生 PostgreSQL 后，先建两库、授权：

```bash
# 1) 建 CMS 主库用户与库（建议专用强密码，勿用容器默认值 juece/juece）
sudo -u postgres psql <<'SQL'
CREATE ROLE juece LOGIN PASSWORD '<强密码>';
CREATE DATABASE juece_grow OWNER juece;
SQL

# 2) Chatwoot 收件箱库（与 CMS 同实例）
sudo -u postgres psql <<'SQL'
CREATE DATABASE chatwoot_production OWNER juece;
SQL
```

把以上连接信息写入生产环境变量（见 §3），绑定时只允许 CMS 所在主机访问该 Postgres。

### 生产 Chatwoot（应用容器）

```bash
cp .env.example .env   # 或从部署密钥库填充 PROD_PG_* / CHATWOOT_* 变量
docker compose -f docker-compose.prod.yml up -d
```

该编排不含任何 Postgres 容器，Chatwoot 直接使用服务器原生 Postgres 的 `chatwoot_production` 库。

Chatwoot **固定绑定** **`127.0.0.1:3300`**，仅由 1Panel 反向代理（站点 `chat.juece.cloud` → `127.0.0.1:3300`）对外暴露，不对公网直连。站点入口由 1Panel「网站」面板维护（证书在面板配置）。

### 收件集成（网页组件 → 自有线索池）

公网站点通过 `PUBLIC_CHATWOOT_URL` / `PUBLIC_CHATWOOT_WEBSITE_TOKEN` 启用在线客服浮窗（见 §3）。访客消息由 Chatwoot 收件箱经 webhook 写回自有 Postgres 线索池：

* **收件箱**：Chatwoot 内建一个 WebWidget 收件箱（name 如 `Juece 官网咨询`，website\_url `https://juece.cloud`），前端 token 即 `PUBLIC_CHATWOOT_WEBSITE_TOKEN`。

* **Webhook 目标**：`https://juece.cloud/api/v2/webhooks/chatwoot?projectId=<项目 id>`，订阅 `message_created`；`CHATWOOT_WEBHOOK_SECRET` 在 Chatwoot webhook 配置里一并维护，两侧必须一致。

* **鉴权**：CMS 收到请求后做 Chatwoot 官方 HMAC-SHA256 校验（`X-Chatwoot-Timestamp + body` → 比对 `X-Chatwoot-Signature`），带 300s 防重放窗口；签名不合法直接 `401`。不再使用 `Authorization: Bearer`。

* **落库**：仅 `message_created` 且 `sender_type=Contact` 的顾客消息才写入 `leads`（source=`support`），其余事件直接 `accepted:false` 确认。去重键取联系 email → phone → `chatwoot:{conversation.id}`，命中已存在线索则补缺字段并把消息并入 `followUpNote`，保留原始归属；`projectId` 必须为正整数。

冒烟脚本 `scripts/recon-mounts.sh` 覆盖三态：正确签名 `/ Contact`（应 200 且去重）、正确签名 `/ 非 Contact`（应 `accepted:false`）、错签名（应 401）。

### 一键部署 / 备份 / 回滚

服务器上 `/opt/juece-grow/chatwoot/` 提供 `deploy-chatwoot.sh`，覆盖 Chatwoot 应用的全量升级安全。

```bash
cd /opt/juece-grow/chatwoot
bash deploy-chatwoot.sh
```

流程与保证：

1. **镜像缓存优先**：固定 tag `chatwoot/chatwoot:latest`。仅当本地无该镜像时才 `docker pull`；已存在则直接复用，绝不无谓重复拉取。
2. **部署前自动备份**：先 `pg_dump` `chatwoot_production` 到 `/opt/juece-grow/backups/chatwoot/chatwoot.<时间戳>.sql`，**保留最近 2 版**，更旧的自动删除。
3. **启动/重建**：`docker compose up -d`（固定 tag，不触发不必要拉取）。
4. **数据迁移自动执行**：等待 web 就绪后自动跑 `rails db:migrate`。
5. **失败自动回滚**：任一步失败（`set -euo pipefail` + trap）自动：停止容器 → 从最近一份备份重建库 → 重启容器 → 以非 0 退出标记失败。成功后不做任何回滚。
6. **健康检查**：末尾探测 `http://127.0.0.1:3300/`，连续不可达同样触发回滚。

> 备份脚本同时保证：库被容器占用也可安全替换（先 `pg_terminate_backend` 断开再 drop/recreate）。

仓库内 `scripts/deploy-provision.sh` 会将该编排与部署脚本落盘服务器并执行一次；日常升级直接跑上面的 `deploy-chatwoot.sh` 即可。

## 2. 构建

根目录一键构建：`pnpm build`（`scripts/build.mjs`，串行执行 CMS 的 TS 校验构建与 Astro SSG）。产物：

* `apps/cms/.next/` — CMS 可运行产物。

* `apps/astro/dist/` — 公开站静态文件，发布到静态服务器即可。

## 3. 环境变量

从 `apps/cms/.env.example`、`apps/astro/.env.example` 复制为 `.env` 配置。生产关键项：

* CMS 主库：`DATABASE_URI=postgres://juece:<强密码>@127.0.0.1:5432/juece_grow`（指向**服务器原生 Postgres**，非容器）。本地开发仍可用容器端口 `5434`。另需 `PAYLOAD_SECRET`、`CHATWOOT_WEBHOOK_SECRET`（与 Chatwoot inbox webhook 签名校验一致：服务端用它对 `X-Chatwoot-Timestamp + body` 做 HMAC-SHA256，比对 `X-Chatwoot-Signature`）。

* 公开站：`PUBLIC_CMS_ORIGIN`（CMS 公网地址）、`PUBLIC_SITE_ORIGIN`（站点公网地址）、`PUBLIC_CHATWOOT_URL` / `PUBLIC_CHATWOOT_WEBSITE_TOKEN`（配了才启用在线客服）。

* 生产 Chatwoot（`docker-compose.prod.yml`）：`PROD_PG_HOST` / `PROD_PG_PORT` / `PROD_PG_USER` / `PROD_PG_PASSWORD`（服务器原生 Postgres）、`CHATWOOT_SECRET_KEY_BASE`、`CHATWOOT_FRONTEND_URL`、`CHATWOOT_HTTP_PORT`。

密钥与 token 只放 `.env`，不进 git。

## 4. 升级安全

* payload 启动会用当前 schema 校验数据库。加字段是安全演进。

* 改名字段 / 改类型 / 改关系：必须走「新增列 → 数据回填 → 独立发布期后删旧列」的扩展迁移，禁止直接改表丢数据。

* 升级前先备份（见 §5）；升级后验证关键链路：登录 admin、首页渲染、表单留资、webhook 写回。

## 5. 备份

备份的是自有 Postgres（`juece_grow` 库），不依赖第三方 SaaS。备份脚本以连接串驱动，从环境 `DATABASE_URI` 取连接，不依赖容器。

```bash
# 手动备份，连接串来自环境变量 DATABASE_URI（保留最近 14 份，可 --keep N）
node scripts/backup.mjs              # 生产：确保环境里有 DATABASE_URI 指向服务器原生库
node scripts/backup.mjs --uri 'postgres://juece:<密码>@127.0.0.1:5432/juece_grow'

# 建议 cron，每天凌晨 3 点跑一次
# 0 3 * * * cd /path/to/juece-grow && DATABASE_URI='postgres://...' node scripts/backup.mjs --keep 30
```

> 生产服务器需安装原生 `pg_dump`（随 PostgreSQL 自带）。本地开发若走容器 Postgres，可用 `docker exec juece-grow-postgres pg_dump -U juece -d juece_grow` 手动导出作对照。

备份落在 `backups/`（该目录已入 `.gitignore`，不提交）。建议把 `backups/` 同步到异机/对象存储，至少保留 30 天。

## 6. 恢复

```bash
# 将备份还原到服务器原生 Postgres（默认库连接）
psql -h 127.0.0.1 -U juece -d juece_grow < backups/{文件}.sql
```

恢复后以 `pnpm cms:dev`（或生产进程）启动 Payload，让它按当前 schema 校验落库；若 schema 有迁移，先执行迁移再起服务。

## 7. 发布清单

1. `pnpm build` 全量通过。
2. 备份数据库。
3. 部署 CMS 产物与 Astro `dist/`。
4. 迁移（若有）+ 启动。
5. 冒烟：admin 登录、公开站首页、表单留资、Chatwoot 客服控件。

