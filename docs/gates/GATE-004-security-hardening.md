# GATE-004 · 整套系统安全与功能闭环修复

> 门禁规则见 AGENTS.md §8：高风险（权限 / 跨域 / 数据）变更先立门禁并获确认后才落地。
> 状态：**APPROVED**（2026-08-27，用户选择「完整加固」）。ID：GATE-004，slug：security-hardening。
> 绑定：CMS（apps/cms）权限与提醒闭环 + 公开站（apps/astro）内容注入与安全头。不迁移业务数据。

## 1. 背景

整套系统（点位：CMS 多项目权限、线索/提醒闭环、公开站内容渲染）做安全与功能闭环审计，发现高危 4 项 + 中危多项，需系统性修复。

## 2. 方案与修复清单

### 高危（H1–H4，全部修复）

| 项  | 问题                                                         | 修复                                                      |
| -- | ---------------------------------------------------------- | ------------------------------------------------------- |
| H1 | 任意登录用户可提权为 admin（Users create/update/delete=authenticated） | Users create/update/delete 收敛为 `adminOnly`              |
| H2 | Leads 匿名可写（原生 REST create=everyone 绕 v2 校验）                | create 改 `authenticated`；公开表单走 v2 `overrideAccess` 不变   |
| H3 | 写/删无项目隔离（Leads/Projects update/delete=authenticated）       | Leads 用 `projectScopedWrite`；Projects 用 `projectManage` |
| H4 | 提醒判重仅看 status=open，已处理后会无限重提醒                              | 判重改为「lead+rule+kind 已存在任意记录即跳过」                         |

### 中危（权限越权 + 提醒闭环 + 公开站 XSS）

* Memberships read 收敛 `projectScopedRead`；beforeDelete 撤销时清理该用户在该项目的 leads.owner / notices.receiver（防孤儿）

* ReminderRules update/delete 收敛 `projectScopedWrite`

* Sites.clone 校验目标/来源项目归属（`memberCanWriteProject`）

* 提醒 SLA 分支读 applyStatuses（消除双口径）；receiver 为空时跳过（消除孤儿提醒）

* chatwoot webhook 用 `timingSafeEqual`（消除时序侧信道）

### 公开站 XSS

* 文章正文 `set:html` 前经 `sanitize-html` 白名单净化

* JSON-LD 序列化转义 `<` 为 `\u003c`（防 `</script>` 闭合逃逸）

### 低危（顺手消除兜底/双写）

* `PAYLOAD_SECRET || ''` 改为缺失即 throw（去兜底）

* feed.xml 的 slug 在 link/guid 内做 XML 转义

## 3. 明确不修（记录，避免过度改动/回归）

* 线索状态机校验与「owner 必须为成员」：涉及运营流转语义，需产品确认口径

* 公开接口限流与 CORS 收敛：依赖部署域名与外部件，留待上线网关统一配置

* 后台工作台统计取数为 0（Dashboard 未带登录态 req）：独立功能问题，另行跟进

* 客单价/转化趋势口径：统计口径产品侧确认

## 4. 风险与影响范围

* 影响：CMS 权限模型（写/删收敛、用户管理限 admin）、提醒判重语义、公开站渲染。

* 风险与缓解：

  * 权限收敛可能误伤合法操作 → 用 Payload access 的 per-doc where 过滤（保留管理员全权），逐一构建 + 端到端脚本验证。

  * H4 判重口径变化：已处理提醒不再重复打扰，属预期行为。

  * 公开表单：create 收敛后需确认 v2 `overrideAccess` 仍可匿名创建。

* 自检项见 §5。

## 5. 自检清单

* [x] 三件事 build 通过（cms `tsc --noEmit` 0 error / astro `astro build` 13 页成功）

* [x] 公开表单（v2/leads）匿名提交仍可创建线索（confirm：route 用 `overrideAccess:true`）

* [x] 非本项目成员无法改/删他人项目线索；普通运营无法创建/改 role 为 admin 的用户（Users 全写收敛 adminOnly）

* [x] 提醒同一段（lead+rule+kind）仅创建一次；SLA 按 applyStatuses；无 null 接收人的孤儿提醒

* [x] 文章正文含 `<script>`/`javascript:` 链接在产物中被净化（sanitize-html 白名单）；JSON-LD 字段含 `</script>` 不逃逸；feed slug 已 XML 转义

* [x] 自研文件 ≤1000 行；无兜底/双写/兼容写法（payload.config secret 去兜底 throw）

## 6. 安全测试体系（规范化）

跨端访问安全落成独立、可复跑的自动化套件，纳入既有 E2E 体系统一执行：

* 套件：`apps/e2e/tests/security.spec.ts`，按安全控制点分块（describe）命名：

  * **C1 跨端文章隔离**：主站全量、分站按项目过滤、越界不出现、未知站点/缺失项目 fail-closed。

  * **C2/C3/C4 原生 REST 匿名收敛**：`/api/articles|projects|sites|forms|categories` 未登录一律 401，杜绝草稿枚举 / 联系人外泄 / 结构枚举。

  * **C3 公开响应脱敏投影**：公开文章响应做字段白名单校验（顶层 + project/category/coverImage 内联对象），任何新增敏感字段未同步清单即测试失败。

  * **C5 CORS 白名单**：白名单 Origin 回 `Allow-Origin`，非白名单/无 Origin 一律不回；白名单 Origin 的留资/预检链路不受误伤。

  * **C6 后台鉴权边界（跨项目隔离）**：以「全局管理员 + 受限成员」身份真实验证——受限成员（仅属项目A）跨项目建线索 / 建成员 / 删别项目成员 / 线索搬家 / 越权分配一律 403，正向（写自身项目A）不被误伤；自建数据并在 finally 自清理。

* 设计约定：

  * 数据无关（不造种子），只断言「无论库里有啥都必须满足」的安全不变量，可零数据复跑。

  * 原生 fetch 发请求，可显式设置 `Origin`/`OPTIONS`，CORS 语义与真实浏览器一致。

  * 测试标题即验收口径，改动安全代码必须在此套件给出对应用例或说明覆盖转移（如 CORS 用例在 C5 块，不再散落 lead.spec）。

* 运行口径：需先 `pnpm --filter cms dev`（cms @ 3000）就绪，再 `pnpm --filter e2e test`；CI 可加 `website-based` 分类白名单。C6 需额外提供 `CMS_ADMIN_USERNAME` / `CMS_ADMIN_PASSWORD`（全局管理员账号）才执行，未提供则自动 skip。

### 6.2 C6 鉴权加固实现说明（follow-up）

承接本次审计在高危项之外新发现的 2 处项目越权（均在 GATE-004 原 #3 收敛后仍存在），修复与配套用例：

* **Memberships 跨项目成员管理**：原 `membershipManage` 只要求「某一项目为 owner/admin」，可越权管别项目成员。改为 `membershipScopedManage`（[access.ts](f:/juece-grow/apps/cms/src/access.ts)）：创建校验 `data.project`、改/删校验目标成员记录所在项目，仅允许对身为 owner/admin 的项目操作。

* **Leads 跨项目写入**：原 `create: authenticated` 无项目校验；update/delete 仅按「现有线索项目」判断，可搬家到无权项目、可越权分配。改为 `leadScopedWrite`：创建校验 `data.project`；改/删校验现有线索项目；改后搬家须具备新项目写权限；直接改 `owner` 时跟进人须为该线索所属项目成员（`isProjectMemberOf`）。

* **实现形式**：全部收敛为 **Access 函数**而非 beforeChange 钩子。原因：chatwoot webhook 与内部级联（Users/Memberships/Projects 删除）均以 `overrideAccess: true` 且**无 user** 调用，beforeChange 钩子必然连坐破坏；Access 由 `overrideAccess` 天然跳过，外部鉴权入口（原生 REST / Payload admin）仍强制项目隔离。

* **回归用例**：`apps/e2e/tests/security.spec.ts` 新增 **C6**（见 §6），自建项目A/B + 仅属A的受限成员，断言 5 类跨项目越权全部 403 + 正向不误伤，finally 自清理数据。

