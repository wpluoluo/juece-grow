# Handoff: security-hardening

> Archived: 2026-08-30 · commit `8ed1dab` · pushed to `gitee/main`

## 本次完成

- 后台鉴权链路全收敛为项目隔离 Access 函数，杜绝跨项目建账/改删/搬家/越权分配。
- 公开内容面统一入口 `/api/v2/content/articles`（跨端隔离 + 白名单投影），原生 REST 匿名收敛为登录可见。
- 公开站渲染安全：文章 sanitize 白名单、JSON-LD/RSS 转义防 XSS。
- Chatwoot webhook 鉴权改 `Authorization: Bearer` 头（恒时比较），本次补 C7 回归用例 3/3 通过。
- 提醒判重语义澄清（H4）；`PAYLOAD_SECRET` 缺失即 throw。
- 新增安全测试套件 `security.spec.ts`（C1–C7），lead.spec 同步 projectSlug 口径。

## 改动文件

30 文件 +1170/−168（见 git show 8ed1dab）

## 关键决策

- **Access 函数而非 beforeChange 钩子**：webhook 与内部级联以 `overrideAccess:true` 且无 user 调用，钩子必然连坐破坏；Access 由 overrideAccess 天然跳过，外部鉴权入口仍强制项目隔离。
- **公开表单用 `projectSlug` 解析**：稳定 slug 非数值 id，校验项目真实存在，fail-closed 不兜底。
- **跨端隔离唯一读取入口**：`/api/v2/content/articles`，主站全量 / 分站按项目过滤 / 未知站点 fail-closed；响应投影白名单，任何新增敏感字段未同步清单即测试失败。
- **安全测试即门禁**：C1–C7 标题即验收口径，改动安全代码必须给出对应用例或说明覆盖转移。

## 协同记录

- 门禁：`docs/gates/GATE-004-security-hardening.md`（APPROVED）
- review：C6 鉴权边界 / C7 webhook 鉴权端到端验证（本文档 evidence）
- evidence：`evidence/verify-before-complete.md`

## 下一步建议

- 部署网关统一做公开接口限流与 CORS 收敛。
- 后台工作台统计取数（Dashboard 未带登录态 req）、客单价/转化趋势口径独立跟进。
- 线索状态机校验与「owner 必须为成员」语义待产品确认后实现。

## 绑定

- Change_ID: security-hardening
- GATE_ID: GATE-004
- Commit: `8ed1dab`
- Req_ID:（无，门禁驱动）