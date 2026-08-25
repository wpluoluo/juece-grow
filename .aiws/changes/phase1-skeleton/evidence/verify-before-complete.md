# Verify Before Complete · phase1-skeleton

> Change: `phase1-skeleton` · Astro + Payload + Postgres 工程骨架（单站点 + 表单线索入池）
> Verified: 2026-08-25
> Branch: `change/phase1-skeleton`

## 验证结论

Phase 1 骨架按 proposal / design / tasks 达成，可复现验证全部通过，无未闭环项。

## 逐项验证记录

### 1. 环境与基础设施

- 命令：`docker compose up -d postgres`
- 结果：`juece-grow-postgres Up (healthy)`，映射 `5434:5432`，`DATABASE_URI=postgres://juece:juece@127.0.0.1:5434/juece_grow`。
- `aiws validate .` → `✓`（托管合同块已同步，无漂移）。

### 2. CMS 生产构建 + TypeScript

- 命令：`pnpm cms:build`
- 结果：`✓ Compiled successfully`、`Finished TypeScript`、生成路由 `/api/v2/health`、`/api/v2/leads`、`/admin/[[...segments]]`。
- 首启以 Webpack（`NEXT_DISABLE_TURBOPACK=1` + `--webpack`）规避 Next16 Turbopack 前端 chunk 加载问题。

### 3. Astro 公开站（SSG）

- 命令：`pnpm astro:build`
- 结果：`✓ 2 page(s) built`，路由 `index.html` 与 `articles/hello-juece/index.html` 均从 Payload 拉取渲染。
- 首页 HTTP 检查：`status=200`，含标题「觉策增长」与 `#lead-form`。

### 4. E2E 烟测

- 命令：`pnpm e2e:test`（`apps/e2e/tests/lead.spec.ts`）
- 结果：**10 passed（3.9s）**，覆盖：
  1. 健康端点统一成功信封 `{success:true,data:{status:'ok'}}`
  2. 首页渲染 Payload 数据并展示线索表单
  3. 表单提交 → Lead 落库 → `{success:true}` 文案
  4. API 直接提交，校验信封与业务 id
  5. 缺 phone/wechat → `error.code=VALIDATION`
  6. 仅填 wechat 提交成功
  7. 非法 JSON → `INVALID_JSON`
  8. 缺失 projectId → `MISSING_PROJECT`
  9. 非法 projectId（0/-1/1.5/abc/空串）→ `MISSING_PROJECT`
  10. OPTIONS 预检 204 + CORS 头 `Access-Control-Allow-Origin:*`

### 5. 代码/规范自检（AGENTS §9）

- 命名三层映射 camelCase（projectId / dedupKey / pathSlug / seoTitle）——校验通过。
- 无外部 CMS / 内容 SaaS 依赖（仅 payload + postgres adapter + lexical + astro）。
- /api/v2 统一信封生效：health、leads 成功与错误路径一致。
- SEO 字段：Layout 含 title/description，Article 含 seoTitle/seoDescription。
- 线索主数据存自有 Postgres（`leads` 表），无 Chatwoot/外部依赖。
- 自研文件全部 ≤1000 行，无兜底/双写/兼容写法（含收敛后 CMS origin 单一来源 `PUBLIC_CMS_ORIGIN`）。
- 影响范围已说明（前端/后端/数据，见 proposal §In Scope 与 design）。

## 审查收敛落地（对照 spec/quality 双审查）

| 审查项 | 处理 | 状态 |
|---|---|---|
| leads POST try/catch（DB 异常入统一信封，不透堆栈） | `route.ts` 已加 try/catch → `err('LEAD_CREATE_FAILED',500)` | ✅ |
| projectId 必为正整数（空串不落 0） | `Number.isInteger(n) && n>0` | ✅ |
| Users 开放注册绕过线索隐私保护 | `Users.access.create=authenticated` | ✅ |
| CMS origin 单一来源 + 禁兜底 | 移除 `||` 兜底，统一 `PUBLIC_CMS_ORIGIN`，补 `apps/astro/.env.example` | ✅ |
| e2e 覆盖边界（INVALID_JSON/非法 projectId/wechat-only/OPTIONS·CORS） | 10 用例全过 | ✅ |
| REQUIREMENTS 验收条款 + REQ-0001 Spec_Status=READY | 已回填，jsonl 置 READY | ✅ |
| DATABASE_URI 端口 5434 口径统一 | design/tasks/.env.example/docker-compose/AI_WORKSPACE 一致 | ✅ |

## 遗留（非本期范围）

- CORS `*` 为开发期配置，上生产前须收敛为白名单 origin（design §生产收敛点）。
- `dedupKey` 已建索引但本期不做查重合并（Phase 2）。
- Lexical 富文本前端渲染 / 多站 / 归因去重（Phase 2/3，见 proposal 非目标）。