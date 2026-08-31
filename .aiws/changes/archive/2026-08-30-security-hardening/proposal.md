# Change Proposal: security-hardening

> Title: 整套系统安全与功能闭环修复（GATE-004）
>
> Created: 2026-08-27
> Archived: 2026-08-30 · commit `8ed1dab`

## 目标与非目标

**目标：**

* 收敛后台鉴权：跨项目隔离，杜绝跨项目建账/改删/搬家/越权分配。

* 收紧公开面：匿名不可枚举内部资源，公开响应白名单投影，跨端内容隔离。

* 消除公开站 XSS 与 webhook 时序侧信道。

* 澄清提醒判重语义，补全自动化安全测试体系（C1–C7）。

**非目标：**

* 公立接口限流与 CORS 收敛策略 —— 依赖部署域名与外部网关，留待上线统一配置。

* 线索状态机校验与「owner 必须为成员」口径 —— 需产品确认。

* 后台工作台统计取数、客单价/转化趋势口径 —— 独立功能问题，另行跟进。

## 主索引绑定（强制）

* `Change_ID` = security-hardening

* 门禁：`docs/gates/GATE-004-security-hardening.md`（APPROVED 2026-08-27）

* `GATE_ID` = GATE-004

* `Commit` = `8ed1dab`（main）

## 现状与问题

* 高危：任意登录用户可提权为 admin；Leads 匿名可写；写/删无项目隔离；提醒已处理后无限重提醒。

* 中危：Memberships 可跨项目成员管理；Sites.clone 未校验项目归属；ReminderRules 非管理员可配全局规则；webhook 时序侧信道；文章体/JSON-LD/RSS 可注入。

* 低危：`PAYLOAD_SECRET || ''` 兜底；feed slug 未转义。

## 方案概述（What changes）

按 GATE-004 §2 落地：鉴权全收敛为项目隔离 **Access 函数**（非 beforeChange 钩子），理由：chatwoot webhook 与内部级联以 `overrideAccess:true` 且无 user 调用，钩子会连坐破坏；Access 由 overrideAccess 天然跳过，外部鉴权入口仍强制隔离。全部实现与门禁一一对应。

## 影响范围（Scope）

* CMS 权限模型（Users/Leads/Projects/Memberships/ReminderRules/ReminderNotices/LeadActivities 访问控制收敛）

* 公开内容面 `/api/v2/content/articles`（新增，跨端隔离 + 投影白名单）

* v2/leads 改 `projectSlug` 解析；公开站渲染净化为 sanitize 白名单 + 转义

* Chatwoot webhook 鉴权改 `Authorization: Bearer` 头

* 新增 `apps/e2e/tests/security.spec.ts`（C1–C7）；lead.spec 同步

* 文档：docs/gates/GATE-004-security-hardening.md、docs/08-deployment.md

## 风险与回滚

* 权限收敛可能误伤合法操作 → per-doc where 过滤保留管理员全权，逐一构建 + 端到端脚本验证。

* 回滚：`git revert 8ed1dab` 单个提交；H4 判重口径变化属预期行为。

## 验证计划（可复现）

* `pnpm --filter cms tsc --noEmit`（0 error）；`pnpm --filter astro build`（13 页成功）

* `aiws validate .`

* `pnpm --filter e2e test`（前置 cms dev\@3000；C6 需 `CMS_ADMIN_USERNAME`/`CMS_ADMIN_PASSWORD`，C7 正确凭据用例需 `CHATWOOT_WEBHOOK_SECRET`，未提供自动 skip）

## 真值文件/合同更新清单

* `docs/gates/GATE-004-security-hardening.md`：门禁记录（新增）

* `docs/08-deployment.md`：webhook 鉴权描述同步（更新）

* 证据落盘：`.aiws/changes/archive/2026-08-30-security-hardening/evidence/verify-before-complete.md`

