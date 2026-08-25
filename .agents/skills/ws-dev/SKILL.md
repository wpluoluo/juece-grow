---
name: ws-dev
description: 使用时机：需要修改代码、配置、测试时。触发词：实现、修复、开发、编码、写代码、改bug。注意：需求未冻结先用 ws-intake；极简修复可走 ws-dev-lite。
---

目标：在 AIWS 约束下完成可回放、可验证的小步交付。阶段：implementation。

## 必需输入

- 真值：`AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`
- 归因：`Req_ID` 或 `Problem_ID`；`change/<change-id>` 上下文
- medium/complex：已通过 `$ws-plan` / `aiws plan-verify` 的计划

## 必需输出

- `变更文件（Changed）:` / `验证（Verify）:` / `证据（Evidence）:` 路径
- `Next:` 准备提交时建议 `$ws-review` 或 `aiws commit`

## 前置条件（硬阻断 — 必须最先检查）

1. **Design Gate**：若 `proposal.md` 不存在 → 立即停止，输出 `BLOCKED: 缺少 proposal。请先执行 $ws-plan`
2. **Task Gate**：若 `tasks.md` 不存在 → 立即停止，输出 `BLOCKED: 缺少 tasks。请先执行 $ws-plan`
3. **Granularity Gate**：对每个 task 估算原子操作数（read/edit/write/run）。若任一 task 需 >3 原子操作 → 立即停止，返回 `$ws-plan` 拆细后再进入。

> 例外：`ws-dev-lite` 可豁免 Design Gate，仅限单文件/typo/config/bugfix 场景。

## Change Type Gate（改动类型门禁 — 硬阻断）

进入实现前，必须先判定本次改动的类型，确定对应的验证要求。

### 改动类型判定规则

根据 `git diff --stat HEAD` 的文件路径自动判定（第一条匹配即生效）：

1. **只看文档/配置文件**（`.md`、`.json`、`.yaml`、`.yml`、`.toml`、`.env*`、`/.github/`、`/scripts/` 等）→ `config-docs`
2. **只改后端文件**（`server_dirs` 内的目录、`.java`、`.py`、`.go`、`.rs`、`pom.xml`、`build.gradle` 等）→ `backend-api`
3. **只改前端文件**（`web_dirs` / `app_dirs` 内的目录、`.vue`、`.tsx`、`.jsx`、`.css`、`.scss` 等）→ 进一步判断：
   - 仅含 `.css`、`.scss`、`.less`、`.vue` `<style>` 区域 → `pure-ui`
   - 含 `.ts`、`.js`、`.tsx`、`.jsx`（非 `.test.` / `.spec.`）中的逻辑代码 → `frontend-logic`
4. **同时改前后端** → `full-stack`
5. **以上均不匹配** → `config-docs`（兜底）

若 `proposal.md` 已显式声明 `Change_Type:`，以声明为准，跳过自动判定。

### 按类型的要求

| 类型 | 最低验证要求 | Playwright 门禁 |
|------|-------------|----------------|
| `pure-ui` | lint + 构建/类型检查 | 不要求 |
| `frontend-logic` | lint + 构建 + **Playwright E2E** | **强制**（必须配置 `AI_WORKSPACE.md` 的 `playwright_test_cmd`/`start_cmd`/`health_check`） |
| `backend-api` | 编译（build_cmd）+ 后端单元测试（连接 dev/test 真实数据库，禁止 H2）+ 接口测试 | 不要求 |
| `full-stack` | 前端 Playwright + 后端测试 | **强制** |
| `config-docs` | lint（如有） | 不要求 |

### 执行门禁

- 若类型为 `frontend-logic` 或 `full-stack`：
  - `AI_WORKSPACE.md` 的 0 配置段必须包含 `playwright_test_cmd` / `start_cmd` / `health_check`
  - 若缺失 → `BLOCKED: 缺少 playwright_test_cmd/start_cmd/health_check。请先补全 AI_WORKSPACE.md 配置`
- 若类型为 `backend-api` 或 `full-stack`：执行前确认 `AI_WORKSPACE.md` 的 `build_cmd` 可用（缺失时按模块约定推断：`mvn compile` / `gradle build` 等，或按完成判定记录文档化豁免）
- 若类型为 `backend-api` 或 `full-stack`：单元测试必须连接 dev/test 环境真实数据库——确认 `AI_WORKSPACE.md` 已配置 `test_db_url`（缺失时先补配置，或按完成判定记录文档化豁免）；**禁止使用 H2 等嵌入式/内存数据库**
- 类型声明必须写入输出中的 `Change type:` 字段

## TDD 约束（强制）

新代码/业务逻辑改动必须走 TDD 循环。详见 `tdd` skill。

## 完成判定

改动已落盘、**验证（含单元测试/编译）已执行且通过**；未执行时必须记录**文档化豁免原因**（写明哪项未执行及理由，落盘到 evidence/）→ 才可进 review/commit。缺测试/编译且无豁免记录 → `BLOCKED`。后端单元测试必须连接 dev/test 环境真实数据库（禁止 H2 等嵌入式/内存库）；使用 H2 代替视为未执行验证。

## 建议流程

### 1. Preflight

定位项目根，读真值，输出约束摘要。中大型先 `$ws-plan`（默认走 3.1）；已有计划先 `aiws plan-verify`；已在 `change/<change-id>` 分支则直接继续。

### 1.5 Spec Refresh（进入实现前必做）

重读 `AI_PROJECT.md` 安全边界与 `REQUIREMENTS.md` 相关条目，输出 2-3 段摘要。

### 2. 建立变更归因

- `git status --porcelain` 仅有计划/工件 → 继续
- 新建：`aiws change start <change-id> --hooks --no-switch`；切换前确认无未提交改动再 `git switch change/<change-id>`（**`change/*` 分支只在 superproject 根仓库**；子模块禁止创建/切换 change 分支，直接在目标分支上开发）
- submodule：准备 `submodules.targets`（`aiws change start` 自动检测 `.gitmodules`）

### 2.5 Submodule Branch Setup（当存在 `.gitmodules` 时 — 硬阻断）

> submodule 处于 detached HEAD 时必须先挂到明确的分支，否则后续 commit 无归属，`change finish` 的 pin 机制也无法正确推导目标分支。

对每个 submodule path（按 `submodules.targets` 自上而下）：

1. **进入 submodule 目录**，检查 `git symbolic-ref HEAD` 是否非空
   - 非 detached（已在一个分支上）→ 跳过 ✅
   - **detached HEAD** → 继续以下步骤 ⛔
2. **获取 target branch**：
1. 读取目标分支（submodule 的目标分支，如 `main`）
   - 优先从 `submodules.targets` 读取目标分支（如 `main`）
   - 不存在则退回到 `.gitmodules` 的 `submodule.<name>.branch`
   - 两者都没有 → 提示用户输入
2. 附着到目标分支：`git checkout <target>`
3. 验证：确认 `git symbolic-ref HEAD` 指向目标分支，输出 submodule branch 状态摘要
4. 若目标分支远程不存在：创建本地分支并提示用户 push

> `.gitmodules` 的 `branch` 字段应写裸分支名（如 `main`）。不写入 `submodules.targets`。
> **硬约束**：禁止在子模块里 `git switch -c change/<id>` / `git checkout -b change/<id>` 创建游离分支（`change/*`/`ws/*` 只属于 superproject 根仓库）。误建时清理：`git switch <target-branch> && git branch -d change/<id>`。

### 3. 实现策略：默认 dispatch aiws-worker（Subagent-First）

详见 `packages/spec/docs/opencode-subagent-first.md`。
- 主 session **默认不直接写代码**；`$ws-delegate` 派发 `aiws-worker`（`task()` 加 `role: worker`）
- worker 返回后派发 `aiws-reviewer` 独立审查，再 fix 或收敛 evidence
- **Inline escape hatch**：用户说"直接改"/`do it inline` 时可直写，须落盘记录理由
- 验证先行：确认 `AI_WORKSPACE.md` 验证命令；不明确则先补入口再实现

### 3.1 自我修正循环（evaluate-optimize）——必经步骤

dispatch 前最多 **2 轮**：产出 → 主 session 检查（lint/typecheck/模式）→ 有问题则修正；2 轮后仍有问题升级 `$ws-review`。适用非 trivial；不替代 `$ws-review` 正式 gate。

### 4. 验证

- 验证跑 `AI_WORKSPACE.md` 命令（未运行不声称已运行）；多步用 `update_plan`

### 5. Requirement Sync Gate（硬阻断 — 新增）

*放在验证后、输出前：*

1. 对比本次改动与 `REQUIREMENTS.md` 当前描述的 API/接口/行为/验收标准的一致性
2. 若有变更但 `REQUIREMENTS.md` 未反映 → **BLOCKED**（先运行 `$ws-req-change` 更新需求）
3. 输出 `REQ_SYNC:` 状态：
   - `SYNCED` — 已同步（REQUIREMENTS.md 已更新）
   - `NOT_NEEDED` — 本次改动不影响现有需求描述
   - `BLOCKED` — 有影响但未更新，阻断提交
4. 提交前必须通过此门禁

### 6. 提交与收尾

- 提交前 `aiws validate .`；收尾 `$ws-finish`
- 运行 `aiws memory write decision://<change-id>/dev` 写入实现决策记录（改动范围、关键选择、影响评估）

## 输出要求

- `Change type:` 改动类型（pure-ui / frontend-logic / backend-api / full-stack / config-docs）
- `变更文件（Changed）:` 文件清单
- `验证（Verify）:` 实际运行的命令 + 期望结果
- `证据（Evidence）:` 证据路径

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`
