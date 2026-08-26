# Quality Review · phase1-skeleton

- 审查类型：行为 / 回归 / 测试覆盖 / 代码质量（Quality 轴）
- 分支：`change/phase1-skeleton`
- 工作目录：`f:\juece-grow`
- 审查日期：2026-08-25
- 评审对象：`apps/cms/src`（payload.config、collections、lib/envelope、app/api/v2/health|leads、migrations）、`apps/astro/src`（lib/payload、Layout、index、articles/[slug]）、`apps/e2e/tests/lead.spec.ts`
- 已通过验证（外部输入）：`aiws validate .`、CMS 生产构建(含 TS)、e2e 5 用例全过、表单提交→lead 落库 Postgres 已验证
- 范围：仅评估写文件，不修改业务代码

> 说明：任务描述中的输出路径 `g:\juece-grow\...` 为笔误（g: 不存在），实际仓库位于 `f:\juece-grow`，本结论已落盘到 `f:\juece-grow\.aiws\changes\phase1-skeleton\review\quality-review.md`。

---

## 1. Triage

**结论：无 HIGH blocker，可继续本 change 的后续收敛；但有 2 个应在真实上线前处理的中等项需记录（open registration、DB 异常未入统一信封）。**

| 严重度 | 数量 | 说明 |
|--------|------|------|
| Critical | 0 | — |
| Warning | 4 | 见下方 #1/#2/#3/#4 |
| Info | 6 | 见 #5–#10 |

单项说明 + 归属标签见下方各重点项。综合来看：正确性主干（统一信封、projectId 数字规整、phone/wechat 校验、lead 落库）、Astro 干净路径（无兜底/双写）、代码硬性约束（≤1000 行、TS 开启）均达标；核心缺口集中在**异常处理未入统一信封**与**开放注册绕过隐私保护**两条边角，属 Quality 轴而非 Spec 违约。

---

## 2. 逐项结果

### 2.1 正确性 —— `apps/cms/src/app/api/v2/leads/route.ts`（POST）

- JSON 解析：`await req.json().catch(() => null)` → 非法 JSON 回 `INVALID_JSON`，单一正确路径。✅
- `projectId` 规整：`Number(projectId)` + `Number.isFinite`。⚠️ 见 #1：`Number('')===0` 为有限数，会漏判；应改为「正整数」判定。
- phone/wechat 校验：`!phone && !wechat` → `VALIDATION`，符合至少填一的语义。✅
- 写入：`payload.create({ collection:'leads', overrideAccess:true, ... })`，字段映射与 Lead 集合对齐（project/name/phone/wechat/note/source/dedupKey/status）。⚠️ 见 #2：`create` 未做异常包装；`overrideAccess:true` 因 create 本就 `everyone`，属冗余但不破坏正确性。
- `source: source || 'website'` 与 Leads 集合 `defaultValue:'website'` 语义重复（见 #7）。

### 2.2 正确性 —— `apps/cms/src/lib/envelope.ts`

- `ok`/`err` 结构严格符合 AGENTS 统一信封（`{success:true,data}` / `{success:false,error:{code,message}}`）。✅
- `err` 默认 status 400，health/leads 两侧一致；`OPTIONS` 统一导出。✅
- CORS：`*` 且无凭据，属 dev 收敛点（代码内已注释说明，见 #9）。

### 2.3 回归/边界 —— `apps/astro/src`

- `lib/payload.ts` `fetchList`：`!res.ok → throw`，SSG 构建期失败即 fail-fast，**无 fallback/兜底/双写**，符合 AGENTS「唯一正确路径」。✅
- `getArticleBySlug` 返回类型 `Article[] | null` 恒不返回 null（`fetchList` 恒返回数组），类型表达不精确，非运行错误（见 #8 附带）。
- `articles/[slug].astro`：`getStaticPaths` 生成已发布 slug 路径 → 详情页 `getArticleBySlug` 命中即渲染，`if(!article) return Astro.redirect('/404')` 为干净路径（非兜底/双写）；SSG 下 null 分支仅在发布态漂移时触发，可接受。✅
- 非正确性/性能：`getStaticPaths`（1 次列表）+ 每篇 `getArticleBySlug`（N 次）构成 N+1（见 #5）。

### 2.4 测试覆盖 —— `apps/e2e/tests/lead.spec.ts`

5 用例覆盖了：健康信封、首页渲染 Payload+表单可见、表单→lead 落库（success:true 文案）、API 直投信封+业务 id 类型、缺 phone/wechat 校验错误信封。✅ 关键路径命中良好。

缺失覆盖（见 #8）：INVALID_JSON、空/非法 projectId（即 #1 的漏洞路径）、wechat 单填、OPTIONS/CORS 预检、DB 失败信封、文章 `[slug]` 详情与 /404 重定向。

### 2.5 代码约束

- 自研文件行数：全部 ≤1000（最大 `migrations/20260825_131753.ts` 约 216 行，为 Payload 生成迁移）。✅
- TypeScript 全程开启，无 `as any` 逃生口（仅 `payload-types.ts` 为生成物）；业务字段均 camelCase（projectId/dedupKey/pathSlug/…），DB 层由 Payload 映射 snake_case，无兼容双写。✅
- 无明显冗余/重复逻辑，除 #6/#7 两处轻微重复。

### 2.6 安全 / 数据

- Lead 主数据只存自有 Postgres（`leads` 表），无 Chatwoot/外部 SaaS 依赖。✅
- `.env` / `.env.*` 已入 `.gitignore`，仅保留 `.env.example`（PAYLOAD_SECRET 为占位符 `replace-with-long-random-secret`），`git status` 确认 `apps/cms/.env` 未跟踪。✅ | `payload.config.ts` 中 `process.env.PAYLOAD_SECRET || ''`、`DATABASE_URI || ''` 为空串兜底，缺 env 时属 fail-fast 前的一次弱默认（无密钥外泄，可忽略或收紧为显式报错）。
- ⚠️ `collections/Users.ts` `auth:true` 且 `access.create: everyon`，集合无 roles 字段 —— 即**任何人可自助注册 admin 用户**，见 #3。

---

## 3. Top Findings

| # | 级别 | 归属 | 说明 |
|---|------|------|------|
| 1 | Warning | QUALITY | `leads/route.ts`：`Number('')===0`，空串 projectId 会通过 `Number.isFinite` 判定(0 为有限数)进入 create，projectId=0 触发 FK 约束失败。应改为「trim 后非空 + 正整数」校验（如 `Number.isInteger(n) && n>0`）。 |
| 2 | Warning | QUALITY+REGRESSION | `leads/route.ts` `payload.create`/`getPayload` 无 try/catch：DB 连接失败、FK 失败等不会包装进统一失败信封，违背 AGENTS「不把 DB 异常原样抛前端、不暴露内部堆栈」与 API 统一信封契约，dev 可能回 500 含堆栈。建议 route 统一 try/catch 并转换成 `err('INTERNAL',...)` + 记日志。 |
| 3 | Warning | QUALITY(安全) | `Users.ts` `create: everyone` + 无角色字段：任何人可自注册为 admin（Users 即 auth 集合），随后登录 admin 读取全部 leads，**绕过 Leads.read 的 authenticated 隐私保护**。建议对比 roles/邀请制，把 Users.create 收窄为 `authenticated` 或关闭注册后再发布。 |
| 4 | Warning | QUALITY | CMS origin 默认值重复且口径不一致：`lib/payload.ts` 用 `import.meta.env.CMS_ORIGIN`，`index.astro` 客户端脚本用 `import.meta.env.PUBLIC_CMS_ORIGIN`，两处各自回退 `http://127.0.0.1:3000`。建议收敛到单一常量/统一配置来源，避免漂移。 |
| 5 | Info | QUALITY | `[slug].astro` N+1 拉取：getStaticPaths 拉一次列表后再逐篇查；性能非正确性，SSG 可接受，后续可批量化取。 |
| 6 | Info | QUALITY | `dedupKey` 已建索引但 route 无去重逻辑（直接写库不查重）；字段名暗示去重意图，Phase2 需补 unique/查重策略。 |
| 7 | Info | QUALITY | `source || 'website'`（route）与 Leads `defaultValue:'website'` 双默认，语义重复；无冲突，任留一种即可。 |
| 8 | Info | QUALITY+REGRESSION | 测试覆盖缺口：未覆盖 INVALID_JSON、空/非法 projectId(即 #1 路径)、wechat-only、OPTIONS/CORS、DB 失败信封、文章 `[slug]`/404 重定向。若先修 #1/#2，建议补对应用例。 |
| 9 | Info | QUALITY(收敛点) | `corsHeaders` `Access-Control-Allow-Origin:*` 为 dev 期配置（已在代码注释注明），当前无凭据请求风险可控；生产需收敛为已知为 origin（含 admin 同源）。 |
| 10 | Info | QUALITY | 迁移为一次性全量建表 + down 全删表，符合 Payload 生成迁移语义（升级红线内加字段为安全演进，未破坏现有数据）。 |

---

## 4. 最小修复清单（仅建议，不在本次改业务代码）

优先级从高到低：

1. 【建议本 change 收敛】`Users.ts` 收紧 `create` 访问（`authenticated` 或关闭注册），避免开放 admin 注册绕过线索隐私。—— 对应 #3
2. 【建议本 change 收敛】`leads/route.ts` POST 增加统一 try/catch，DB/连接异常转 `err('INTERNAL',...)`，不抛原生堆栈。—— 对应 #2
3. `leads/route.ts` `projectId` 校验改为「非空 + Number.isInteger && >0」。—— 对应 #1
4. 收敛 CMS origin 默认值至单一口径。—— 对应 #4
5. 补齐 e2e：INVALID_JSON / 非法 projectId / wechat-only / CORS / DB 失败信封；补 `[slug]` 详情与 /404 重定向用例。—— 对应 #8
6. 记录 CORS `*` 收敛点为生产门禁项；记录 `dedupKey`、`source` 双默认的后续收敛。—— 对应 #6/#7/#9

评审净评：主干正确、无兜底/双写，符合 AGENTS 代码硬性约束；主要风险集中在异常路径与开放注册两处，建议按上表 #1–#3 处理后再进 commit 门禁。