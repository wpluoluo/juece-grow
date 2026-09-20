# 发布前置（生产侧）· cleanup-batch-20260919

> 本批全程只在本地 dev/test 执行（容器 Postgres `127.0.0.1:5434`），**未连接、未改动任何线上资源**。
> 以下是把本批改动推到生产前必须逐条完成并由人确认的清单；从 `tasks.md §5` 移交至此，使 change 台账只保留本批已完成项。
> 日期：2026-09-19

## 1. 迁移不会自动生效（先读这条）

`@payloadcms/db-postgres/dist/connect.js:116` 仅在 `NODE_ENV === 'production' && this.prodMigrations` 时启动 migrate，而 `apps/cms/src/payload.config.ts` 的 `postgresAdapter({ pool })` 只传 `pool`，全仓无 `migrations` 相关配置 ⇒ **线上永不自动跑迁移**。

后果与处置方向：

- 不做任何事：线上 `leads_activity` 死表继续存在（不丢数据、不报错），本批的 schema 清理在线上未落地。
- 要真正清理：在维护窗口对线上库**显式**执行 `payload migrate`，且该命令会连带跑完所有待执行迁移 ⇒ 必须先做下面 §2、§3。

## 2. 执行迁移前的核实（阻断项）

```bash
# a) 死表是否真的没人写：期望 0
psql "$PROD_DB" -c 'select count(*) from leads_activity;'
# b) 迁移账本实态（本地已出现 batch=-1 的 dev 行，线上未知）
psql "$PROD_DB" -c 'select batch, name from payload_migrations order by batch, name;'
# c) 可用备份（脚本要求显式连接串，无内置默认）
node scripts/backup.mjs --uri "postgres://juece:<强密码>@127.0.0.1:5432/juece_grow"
```

- 若 (a) 不为 0：本迁移回退为「重命名留观」而不是 `DROP`，另立 change 处理。
- 若 (b) 显示线上库由 dev-push 生成（缺基线迁移行）：`payload migrate` 可能被 Payload 自身的数据丢失门禁拒跑，需先补记账或走人工 DDL，禁止 `-f` 强推。

## 3. 部署契约变更（CORS）

- 生产容器环境必须注入 `PUBLIC_CORS_ORIGINS`（三站 origin 逗号分隔），再走 `scripts/cms-run.sh`；脚本内的 `${PUBLIC_CORS_ORIGINS:?}` 会在 `docker run` 之前终止，这是设计意图。
- 语义澄清（按实测）：漏配时**进程能起**、`/api/v2/health` 与所有 `/api/v2/*` 在首个请求即 500 且响应体不含堆栈——排查时不要把症状当容器启动失败。

## 4. 部署后回归

- 三站留资表单提交成功并落自有 Postgres 线索池。
- `/api/v2/content/articles` 从三个公开站 origin 跨端可读（CORS 命中白名单），非白名单 Origin 不出 `Access-Control-Allow-Origin`。
- 后台 `leads` 编辑页不再出现「跟进历史」区块（本批删除的死字段），其余区块无回归。
- `reminder-notices` 后台列表与看板「待跟进提醒」计数正常。

## 5. 运维核对（人工）

- [ ] `select count(*) from leads_activity` 线上为 0
- [ ] 线上 `payload_migrations` 记账状态已记录并据此选择迁移方式
- [ ] 存在覆盖执行前状态的备份文件
- [ ] `PUBLIC_CORS_ORIGINS` 已注入生产 env
- [ ] 上述四项完成后，方可在维护窗口执行 `payload migrate` 并跑 §4 回归
- [x] `scripts/backup.mjs` 曾内置的默认连接串（口令字面量）自 `4a7d807` 起在 git 历史中：本批已删除该兜底并停止回显口令。**口令不轮换已由 owner 于 2026-09-20 裁决**（PROB-010 闭环，git 历史里的字面量不再处置、不再追问）。
