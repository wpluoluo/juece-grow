# AGENTS.md · juece-grow 项目规范

<!-- AIWS_MANAGED_BEGIN:agents -->
本仓库启用 AIWS（AI Workspace）约定。真值文件（按优先读取）：
1) `AI_PROJECT.md`（规则/边界）→ 2) `REQUIREMENTS.md`（需求与验收真值）→ 3) `AI_WORKSPACE.md`（运行/测试入口真值）

快速分流：
- 小修（≤3 文件，≤100 行）→ `/ws-dev-lite`
- 常规实现 → `/ws-plan` → `ws-dev`
- 高风险变更 → 加 `ws-spec-review` + `ws-quality-review` 双审查
- 不确定 → `/using-aiws`（先读真值，再路由）

协作约束：
- 变更绑定 `change/<id>`，走 plan→verify→dev→review→commit→finish
- review 完成 → `aiws verify-bc` 确认验证通过 → 再 finish
- review 三方（spec/quality/verify）需 triage 确定是否有 HIGH blocker
- 主 session 编排收敛，不直接写业务代码；实现与验证由 subagent 产出
- 提交前 `aiws validate .`；敏感信息不入 git
- 缺真值文件先 stop，不直接开工
- handoff 产出 `handoff-evidence.md` 供后续 session 恢复

Red Flags（这些想法都是错的）：
| 你想的 | 实际 |
|--------|------|
| "看着简单直接改" | 简单→ws-dev-lite，不确定→先 /using-aiws |
| "先动手再说" | 评估先于行动，分流在实现之前 |
| "跳过 review" | review 是门禁，不是建议 |
| "主 session 自己写代码" | 编排收敛，subagent 实现 |
| "不想走流程直接改" | escape-hatch: 可走 ws-dev-lite，但须遵守最小约束（降级需标明） |

阶段产物（最少）：intake=`.aiws/plan/*.intake.md` | planning=`.aiws/plan/...`+`proposal.md`+`tasks.md` | dev=代码+Verify | review=`review/...` | validate=`aiws-validate/*.json` | archive=`evidence/...`+`handoff.md`

平台前缀：OpenCode=`/` | 例：`/ws-dev`

Pi 宿主：双审查入口 `ws-spec-review`（流程/规范）与 `ws-quality-review`（实现质量/覆盖）位于 `.agents/skills/`（Pi ≥0.84 自动发现，无需镜像；`/ws-spec-review`、`/ws-quality-review`）；通用入口 `/ws-review`（two-axis：standards + spec）始终可用。

## Memory Protocol

本仓库使用 `aiws memory` 系统持久化跨会话知识。automation 协议：

1. **自动注入（插件）** — `.opencode/plugins/memory-autoload.js` 在会话首次消息时读取活跃目标、近期决策、项目概览并注入 `<memory-context>`。需依赖：`MEMORY_AUTOLOAD_DISABLE=1` 可关闭
2. **会话启动时** — 自动读取 `.aiws/memory-bank/.index.yaml` 获取记忆索引，了解已记录的知识领域
3. **回答前** — 若问题涉及已记忆的领域，先用 `aiws memory search <keywords>` 检索相关记录
4. **获取新知识后** — 对重要决策、根因分析、架构约定等跨会话有价值的信息，使用 `aiws memory write <domain>://<path>` 写入永久记忆（写入会自动更新索引）。标记 `--disclosure boot` 可让记忆出现在下次插件注入中
5. **记忆关联** — 对相关记忆使用 `aiws memory link add` 建立关系
   目标：把关键认知固化到 git-tracked 文件，实现跨机器/跨会话的知识连续性。
6. **即时记忆触发**：你说"记住：xxx"或类似触发短语时，立即用 `aiws-memory_write` 写 `decision://` memory，不等 skill 阶段完成。详见根 `docs/agents/memory-protocol.md#即时记忆触发会话级`。
<!-- AIWS_MANAGED_END:agents -->

本文件定义本仓库 Agent 与开发者的协作方式、命名规范、执行边界与红线约束。

## 1. 项目身份
- 项目：juece-grow（觉策增长）
- 定位：开源独立项目，管理你名下多个产品的获客、内容、线索与宣传。
- 根目录：F:\juece-grow
- 相关既有项目 juecesass 在 F:\juecesass，本仓与其相互独立，不混合依赖、不混用模块与字段。

## 2. 真值文件
1. docs/01-plan.md          需求与范围真值
2. docs/02-architecture.md  架构与技术选型真值
3. docs/03-data-model.md    数据模型真值
4. docs/06-roadmap.md       交付节奏真值
5. docs/gates/*.md          门禁记录（每次重大改动先立门禁）

冲突时：用户当前明确要求 > 上述文档 > 本文件。

## 3. 技术栈红线
- 公开站点：Astro（内容优先、SSG 静态，多营销站与 SEO 主场景）
- 后台/内容/线索/数据：Payload 3 自托管（MIT、角色不限），原生 admin / Auth / Lexical 富文本，后台不自研
- 数据库：PostgreSQL 16（Payload 官方 stable 适配器），数据模型由 Payload 自管
- 客服收件：Chatwoot（仅作收件箱，线索主数据在自有 Postgres）
- 认证：Payload 内建 Auth（JWT/Cookie），不自研
- 禁止引入外部 CMS（Strapi / Directus / Halo 等）与外部内容 SaaS；内容模型在 Payload 自建

## 4. 代码约束（硬性）
- 自研文件单个不超过 1000 行。超过即拆分，禁止靠堆行数。
- 禁止兼容写法、禁止双写、禁止兜底逻辑（fallback）。只保留一条正确的实现路径。
- 发现冗余/兜底/双写代码，立即精简至唯一路径。
- TypeScript 全程开启，业务字段 camelCase，同名同义。

## 5. 命名规范（三层映射）
```
前端/接口/业务对象: camelCase
Payload 字段:     camelCase（DB 层由 Payload 映射 snake_case）
PostgreSQL:       snake_case
```
- 禁止同时保留 camelCase 与 snake_case 的兼容写法。
- 发现 snake_case 泄漏到业务层立即修正。

## 6. API 规范
- 对外统一 /api/v2/*
- 资源化路径命名
- 成功：{ success: true, data }
- 失败：{ success: false, error: { code, message } }
- 不把数据库异常原样抛前端，不暴露内部堆栈。

## 7. 数据与升级红线
- 数据自持在自有 Postgres，不依赖任何 SaaS 库。
- 线索主数据只存自有库，Chatwoot 只是收件箱。
- Payload schema 变更遵循官方迁移流程：加字段为安全演进；改名字段/改类型/改关系必须走「新增列 → 数据回填 → 独立发布期后删旧列」的扩展迁移，禁止破坏性改表丢数据。
- 升级优先保证内容数据不丢失、配置不被覆盖。
- 不批量爬取抖音/小红书，遵守平台规则，人工/官方能力入池为主。

## 8. 开发流程（门禁优先）
- 动手前必须：加载相关技能（如 UI 类用 frontend-design / web-app-development）→ 充分调研现状与文档 → 对比可选方案优劣 → 重大改动先立门禁（docs/gates/GATE-<id>-<slug>.md，含背景、方案对比、风险、影响范围、自检项），门禁未获确认不落地。
- 小修(≤3 文件，≤100 行，非数据/权限/跨域)：直接改并过自检清单。
- 常规实现：绑定 change/<id>，走 计划 → 实现 → 验证。
- 高风险（数据迁移 / 权限 / 跨域 / 破坏性变更）：双审查(review)后合并。
- 提交前自检：命名、SEO 字段、权限、影响范围、文件行数、有无兜底/双写。

## 9. 自检清单（变更后必过）
- [ ] 命名是否符合 camelCase 三层映射
- [ ] 是否引入外部 CMS / 新依赖（对照红线）
- [ ] API 响应格式是否统一（/api/v2 + 统一信封）
- [ ] SEO 字段(标题/描述/canonical)是否齐全
- [ ] 线索数据是否仍在自有 Postgres
- [ ] 自研文件是否 ≤1000 行，有无兜底/双写/兼容写法
- [ ] 影响范围是否说明(前端/后端/数据)