# 08 · 部署、升级与备份策略

> 本文档定义 juece-grow 的部署形态、升级安全与备份/恢复口径。原则遵循 AGENTS.md：
> 内容数据不丢失、配置不被覆盖、schema 变更禁止破坏性改表。

## 1. 部署形态

生产拆三段，各自独立、可分布在任意主机：

| 组件                            | 形态      | 运行                                                                         |
| ----------------------------- | ------- | -------------------------------------------------------------------------- |
| Payload CMS + admin + /api/v2 | Node 进程 | `pnpm cms:build` → `.next/standalone` 或 `next start`，端口 3000               |
| 公开站 Astro                     | 纯静态产物   | `pnpm astro:build` → `dist/`，交给 Nginx/CDN                                  |
| PostgreSQL + Chatwoot         | Docker  | 根 `docker-compose.yml`（Postgres 5434）+ `infra/chatwoot/docker-compose.yml` |

数据库跑在 Docker 容器；CMS 与公开站跑在宿主进程（与本地开发同构）。

## 2. 构建

根目录一键构建：`pnpm build`（`scripts/build.mjs`，串行执行 CMS 的 TS 校验构建与 Astro SSG）。产物：

* `apps/cms/.next/` — CMS 可运行产物。

* `apps/astro/dist/` — 公开站静态文件，发布到静态服务器即可。

## 3. 环境变量

从 `apps/cms/.env.example`、`apps/astro/.env.example` 复制为 `.env` 配置。生产关键项：

* CMS：`DATABASE_URI`（指向 Docker 内 Postgres）、`PAYLOAD_SECRET`、`CHATWOOT_WEBHOOK_SECRET`（与 Chatwoot inbox webhook 请求头 `Authorization: Bearer <此值>` 一致）。

* 公开站：`PUBLIC_CMS_ORIGIN`（CMS 公网地址）、`PUBLIC_SITE_ORIGIN`（站点公网地址）、`PUBLIC_CHATWOOT_URL` / `PUBLIC_CHATWOOT_WEBSITE_TOKEN`（配了才启用在线客服）。

密钥与 token 只放 `.env`，不进 git。

## 4. 升级安全

* payload 启动会用当前 schema 校验数据库。加字段是安全演进。

* 改名字段 / 改类型 / 改关系：必须走「新增列 → 数据回填 → 独立发布期后删旧列」的扩展迁移，禁止直接改表丢数据。

* 升级前先备份（见 §5）；升级后验证关键链路：登录 admin、首页渲染、表单留资、webhook 写回。

## 5. 备份

备份的是自有 Postgres（`juece_grow` 库），不依赖第三方 SaaS。

```bash
# 手动备份（保留最近 14 份，可 --keep N）
node scripts/backup.mjs

# 建议 cron，每天凌晨 3 点跑一次
# 0 3 * * * cd /path/to/juece-grow && node scripts/backup.mjs --keep 30
```

备份落在 `backups/`（该目录已入 `.gitignore`，不提交）。建议把 `backups/` 同步到异机/对象存储，至少保留 30 天。

## 6. 恢复

```bash
# 将备份还原到容器（示例：恢复到指定库或重建容器后执行）
docker exec -i juece-grow-postgres psql -U juece -d juece_grow < backups/{文件}.sql
```

恢复后以 `pnpm cms:dev`（或生产进程）启动 Payload，让它按当前 schema 校验落库；若 schema 有迁移，先执行迁移再起服务。

## 7. 发布清单

1. `pnpm build` 全量通过。
2. 备份数据库。
3. 部署 CMS 产物与 Astro `dist/`。
4. 迁移（若有）+ 启动。
5. 冒烟：admin 登录、公开站首页、表单留资、Chatwoot 客服控件。

