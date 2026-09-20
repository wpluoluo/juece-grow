# Handoff: cleanup-batch-20260919

> Archived: 2026-09-20T09:09:17Z

## 本次完成

- 消除 `REQUIREMENTS.md` 与执行合同的漂移：REQ-0001/REQ-0002 已 `Impl_Status=DONE` 却仍留在重复的 `## Backlog` 段、验收框全未勾、`已完成` 区仅有注释示例。
- 删除 Payload 死模型 `Leads.activity` 及其 `leads_activity` 表（AGENTS.md §4 禁止双写）。
- 收敛 `envelope.ts` 的 CORS 内置默认白名单为 fail-fast（AGENTS.md §4 禁止兜底），并做到「配置先行」，使漏配在部署阶段显式失败而非静默损坏线上留资。

## 改动文件

- (see git log for details)

## 关键决策

- **D-1（#2 删字段）现在就出 drop 迁移**：依据 dev 库 `leads_activity` 实测 0 行、全仓 `activity` 零读写。备选「只删 schema 留迁移到下窗口」会使 dev/prod schema 漂移，违反"只保留一条正确路径"，不取。
- **D-2（#4 强度）fail-fast 而非静默拒**：`PUBLIC_CORS_ORIGINS` 缺失即抛错。理由——静默不颁发 CORS 头的故障表现是"表单点了没反应"，排查成本远高于容器起不来；且 `cms-run.sh` 已是 `${VAR:?}` 风格，部署侧与运行侧同一种失败语义。
- **D-3（#4 顺序）配置先行**：变量先落到 `.env.example` / `cms-run.sh` / `docs/08-deployment.md`，再删代码默认值。因线上真实依赖默认值，顺序颠倒会在下次部署打断三站留资。
- **D-4（#6 造数）admin 直调 Payload REST**：不新增 `dev-seed` 端点。空目录 `src/app/api/dev-seed` 按删除处理，与 D-4 一致（不留"声明了但没实现"的入口）。提醒扫描的时间条件用"造 `createdAt` 在过去的数据"满足，不改产品代码引入可注入时钟。
- **D-5（范围纪律）`DATABASE_URI || ''` 不在本批**：与 D-2 同类兜底，但 Payload 在构建期同样读取该配置，直接抛错可能打断 `next build`；需单独设计"构建期/运行期"边界，不随清理批次静默扩范围。登记为后续独立 change。

## 协同记录

- analysis: 0 file(s)
- patches: 0 file(s)
- review: 2 file(s)
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/review/quality-review.md
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/review/spec-review.md
- evidence: 11 file(s)
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/aiws-validate-stamp-20260919-141641Z.json
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/change-status-20260919-141641Z.json
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/change-sync-stamp-20260919-141641Z.json
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/change-validate-strict-20260919-141641Z.json
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/collaboration-summary-20260919-141641Z.json
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/delivery-summary-20260919-141641Z.md
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/dev-log.md
  - .aiws/changes/archive/2026-09-20-cleanup-batch-20260919/evidence/follow-ups.md
  - ...(truncated)

## 下一步建议

- 可以开始: （无）

## 绑定

- Change_ID: cleanup-batch-20260919
- Req_ID: REQ-0001
- Problem_ID: PROB-001
