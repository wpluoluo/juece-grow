# Verify Before Complete · security-hardening

> Change: `security-hardening` · 整套系统安全与功能闭环修复
> GATE: GATE-004（APPROVED 2026-08-27）
> Verified: 2026-08-29 · commit `8ed1dab`
> Branch: `main`

## 验证结论

按 GATE-004 门禁与 proposal 达成，鉴权/auth/webhook 链路经审计与端到端验证通过，无未闭环高危项。

## 逐项验证记录

### 1. 鉴权隔离（Access 收敛）

- `Users` create/update/delete → `adminOnly`；H1 修复，非管理员无法提权为 admin。
- `Leads` 用 `leadScopedWrite`：创建校验 `data.project` 写权、改/删校验现有项目、搬家校验新项目、直接改 owner 校验 `isProjectMemberOf`。
- `Memberships` 用 `membershipScopedManage`：创建校验 `data.project`，改/删校验目标成员记录所在项目，防跨项目成员管理。
- `Projects` 用 `projectManage`；`ReminderRules` 全局规则仅 admin 可配。均以 Access 函数实现，规避 `overrideAccess:true` 无 user 调用的 hook 连坐。

### 2. 公开面收敛

- `/api/v2/content/articles`：跨端隔离读取唯一入口，`site` 白名单 fail-closed；响应白名单投影（不泄联系人等内部字段）。C3 用例逐字段断言。
- 原生 `/api/articles|projects|sites|forms|categories` 匿名一律 403（C2/C4）。

### 3. XSS / 侧信道 / 兜底

- 文章正文 `set:html` 前 sanitize-html 白名单；JSON-LD `<`→`\u003c`；feed slug 转义。
- Chatwoot webhook 用 `timingSafeEqual`，本次再改 `Authorization: Bearer` 头（C7 验证 3/3 通过）。
- `PAYLOAD_SECRET` 缺失即 throw（`payload.config.ts`）。

### 4. 提醒闭环语义（H4）

- 判重改为「lead+rule+kind 已存在任意记录即跳过」，已处理不再无限重提醒；`receiver` 为空跳过防孤儿提醒。

### 5. E2E 自动化套件

- 新增 `apps/e2e/tests/security.spec.ts`（C1–C7），数据无关、可零数据复跑，finally 自清理。
- 实测 C7（webhook 鉴权）3/3 通过：无头 401、错 secret 401、正确 Bearer 放行至业务层（400 INVALID_PROJECT 证明鉴权已通过）。

## 审查收敛落地

| 审查项 | 处理 | 状态 |
|---|---|---|
| Memberships/Leads 跨项目越权 | 收敛为 `membershipScopedManage` / `leadScopedWrite`，Access 函数实现 | ✅ |
| H2 公开表单匿名创建 | v2/leads 用 `overrideAccess:true` 证明确保匿名可建，C5 白名单 Origin 链路未误伤 | ✅ |
| 自动化测试作为门禁 | 测试标题即验收口径，改动安全代码必须在 C1–C7 给出对应用例或说明覆盖转移 | ✅ |

## 遗留（后续）

- 公开接口限流与 CORS 收敛依赖部署网关统一配置。
- 后台工作台统计取数、客单价/转化趋势口径独立跟进。
- 线索状态机校验与「owner 必须为成员」语义待产品确认。