# Bugfix Workflow — Phase 1-10 详细步骤

本文件是 `ws-bugfix` skill 各 phase 的完整操作说明。**唯一真值源**——修改 phase 逻辑时请编辑此处，而非 SKILL.md。

---

## PHASE 1 — INTAKE（数据获取，无 AI 转译）

- `aiws bugfix start <bug-id>`：创建 change（`bugfix-<bug-id>`）+ bugfix-state.json
- 通过 Zentao MCP `get_bug_detail` 拉取 bug 详情
- **原始 JSON** 落盘到 `bug/zentao-bug-<id>.json`（完整字段，不允许裁剪）
- 下载附件图片到 `bug/images/<id>/`
- **不生成 intake Markdown**（不需要"分析"段或 AI 重述）
- 输出摘要信息到终端即可
- `aiws bugfix advance bugfix-<bug-id>` → ANALYZE

## PHASE 2 — ANALYZE（根因分析）

- **Bug 详情源**：`bug/zentao-bug-<id>.json`（直接读取，不参考任何 MD）
- 运行 `diagnosing-bugs`（反馈循环 → 复现 → 假设 → 打点），确认 root cause
- 有疑问/歧义时走 `grill-with-docs`：引用 `docs/adr/` 现有决策，或生成新 ADR
- 输出根因结论到终端 + 写入 evidence
- 根因与影响面明确后、advance 前执行 **REQ SYNC 主判定**（硬门禁，详见 [REQ_SYNC_GATE.md](REQ_SYNC_GATE.md)）：对比本次修复涉及的 API 行为/接口字段/错误信息与 `REQUIREMENTS.md` 当前描述，有偏差则**此时**更新真值（`$ws-req-change` 更新 `REQUIREMENTS.md`，或记 `requirements/CHANGELOG.md`），输出 `REQ_SYNC:` 状态
- `aiws bugfix advance bugfix-<bug-id>` → FIX

### 收敛规则（强制）

防止无限深挖导致上下文膨胀（749 案例 8+ 轮推理不收敛、上下文冲到 102K）：

1. **假设-验证循环上限 3 轮**：每轮必须验证或排除一个假设；3 轮后仍无法定位根因 → 停止深挖，输出待确认项，`aiws bugfix advance` 或标记 `needs_human`
2. **深挖检测**：同层排除 > 5 个候选后，强制退回更高层（重读 bug 描述，确认复现预期）
3. **阶段预算**：analyze 阶段 input 上限 ~60K tokens；超出时必须收敛（输出当前结论并 advance，不继续深挖）

## PHASE 3 — FIX（最小修复 · 分层拆单）

- **Bug 详情源**：`bug/zentao-bug-<id>.json`（直接读取）

### 分层拆单（先进 FIX 先判规模，再决定是否拆单）

`aiws bugfix advance` 进入本阶段时会输出 `[拆单]` 引导（diff 统计 + 子模块检测 + 建议），最终由 agent 判定：

| 级别 | 判据 | 处理 |
|------|------|------|
| 级1 快速修（默认） | 单模块、≤3 源文件、无跨子模块 | 直接下方最小修复，无需任务规划 |
| 级2 任务栈拆单 | 跨 ≥2 子模块、或 ≥4 源文件 | 写 tasks.md → init → fix-plan 派发 |

**级2 操作步骤（命令链，D2 自动拆单）**：
1. （可选）`aiws bugfix split-auto <change-id> --dry-run` → 预览自动拆分计划（task-frontend/task-backend/task-root 分组 + 各自 scope）
2. `aiws bugfix split-auto <change-id>` → 自动写 `tasks.md`（含 scope/verification）+ 调 `change tasks init` 生成 `tasks/tasks.jsonl`，并按分组补齐 JSONL 的 scope/verification（并行就绪）
3. `aiws bugfix fix-plan <change-id>` → 调 `change tasks execute` 逐任务派发 subagent（可先 `--dry-run` 看执行计划）
4. 跨子模块大 bug 启用并行：`aiws bugfix fix-plan <change-id> --parallel N`（或 `split-auto <change-id> --parallel N`）→ 无依赖任务全部 spawn 后经 `spawner.waitAll` 并发等待；写冲突防护（D4）按 scope 子模块归属判定：互不相交才并行，共享子模块或无法归属时自动回退串行并 warn
5. 主 session 收敛：逐任务确认 `evidence/done.signal` 与 `summary.md` 后汇总 commit，随 change 一起 finish

**每任务产物（约束）**：
- `tasks/<task>/evidence/done.signal`（内容为 `complete`）
- `tasks/<task>/evidence/summary.md`（≤15 行：完成内容、验证命令实际结果、遗留问题）

> **并行隔离（D2）**：任务的写冲突防护按子模块归属判定——子模块独立 worktree 天然隔离（可安全并行）；同子模块/根仓库共享文件/无法归属的 scope 必须串行（`--parallel` 会自动 warn + 回退）。并行期每个 subagent 只改动自己 scope 内的文件；explorer/read-only/证据检查可并行且无需独立分支；并行期间主 session 只做纯读准备，不 FIX、不改代码、不重启服务。所有任务改动都在 `change/<change-id>` 分支上，随 change 一起 finish。

### 最小修复（级1 / 单任务内）

- 进入 `$ws-dev` 做最小改动
- LSP clean
- 修复证据（改了什么、为什么）落盘到 evidence
## PHASE 4 — TEST（测试验证 + 回归脚本产出）

- 引用 `_shared/bugfix/test-gate.md`（若存在）：按改动模块选择测试命令，测试证据落盘到 `.aiws/changes/<change-id>/bug/test-reports/`
- **测试数据库约束**：单元测试必须连接 dev/test 环境真实数据库（`AI_WORKSPACE.md` 的 `test_db_url` / `test_db_cmd`），**禁止使用 H2 等嵌入式/内存数据库**（SQL 方言/行为与生产不一致）
- **测试未通过则不能进入 VERIFY**
- **必产出——回归验证脚本/用例**（产物路径由项目约定决定）：
  - 优先：项目 `scripts/` 下独立可运行的脚本，如 `scripts/test-bug-<bug-id>.mjs`
  - 可选：模块单元测试（vitest/jest）或 Playwright E2E 用例
  - 脚本必须覆盖「修复前应失败、修复后应通过」的场景，输入→操作→断言完整
  - 脚本应独立可运行，不依赖启动服务（可 mock 外部依赖）

### E2E / Playwright 用例编写规范（强制）

写 Playwright E2E 用例时，必须遵守：

1. **优先复用 `e2e/common/` 公共 fixture**：写用例前先 `ls <web>/apps/web-naive/e2e/common/`，确认是否有可复用的工具（常见 `wait.ts` 的 `waitForPageReady`、`vxe.ts` 的 `waitForVxeGrid`/`vxeBodyRows`、`auth.ts` 的 `loginAs` 等）。有则 import 复用，**不要重复造轮子**。
2. **禁止裸 `waitForTimeout` 做大段等待**：大段硬等（>800ms 的 sleep）必须改为条件等待——用 `expect(...).toBeVisible()` / `waitForResponse` / `waitForFunction`（或复用 common 封装）。仅允许 <800ms 的微调 settle，且需加注释说明等待理由。
3. **树/懒加载组件选择**：对懒加载树（节点初始不在 DOM，需点展开才渲染）保留展开逻辑，勿用 `hasText` 一刀切（会找不到未渲染节点）；用稳定的公开 class token（`.n-tree`、`.vxe-body--row`）而非哈希 scoped 类。
4. **页面就绪**：用 `common/wait.ts` 的 `waitForPageReady`（渐进式布局检测），不要自己写 `waitForFunction(() => !!document.querySelector('.n-tree'))`。
5. 协议说明见 `e2e/common/*.ts` 顶部注释（PROB-E2E-xxx）。

### 视觉验证规范（识图场景强制）

视觉分支必须先落盘截图/trace/多图，再由独立 tmux Pi worker 只接收路径并显式使用 `aipper/qwen3` 或 `aipper/gpt-5.5`；主 session 不读图片本体。路径、模型或读取失败必须写 evidence 并标记 `BLOCKED`。完成必须有 `summary.md`、结构化结果（可用 `visual-result.json`）和 `done.signal`。



```
本环境 pi 主模型 deepseek-v4-flash **不支持识图**。遇到需要看图的任务（E2E 截图判读、页面视觉状态验证、trace 截图分析、UI 渲染确认）时：
1. **必须派带视觉的 subagent 看图**，在 subagent 工具调用参数中显式指定模型：model: "aipper/qwen3" 或 "aipper/gpt-5.5"（pi-subagents 支持 params.model，格式 provider/modelId；config.model 优先于 params.model）
2. **禁止**主模型直接"看"截图——看不到图，纯浪费 token（教训：890 调试时解包 533 张 trace 截图主模型一张也看不见）。
3. 截图分析场景：让 subagent 读取截图路径（如 /tmp/trace-imgs/*.jpeg、playwright test-results 截图），描述页面状态（是否有行/弹窗/报错/回显），再据此判断。
4. 需要页面视觉证据时：先 Playwright 截图落盘，再派视觉 subagent 判读，把结论写进 evidence。
```

## PHASE 5 — VERIFY（对照验收 + 回归验证）

- 对照 `bug/zentao-bug-<id>.json` 的 `expect` 与 `actual` **逐条**验证修复效果
- 验证方式：复现原 bug 场景，确认行为符合 expect；输出逐条对照表
- **回归验证**（Phase 4 产出的脚本/用例）：
  - 运行回归脚本：`node scripts/test-bug-<bug-id>.mjs`（或其他对应命令）
  - 运行项目测试套件：`npm test`（确保无新增失败）
  - 确认单元测试运行在 dev/test 环境真实数据库上（`AI_WORKSPACE.md` 的 `test_db_url`，非 H2 等嵌入式/内存库）；真实库 + 测试通过才算回归验证通过
  - 上面各项均通过，回归验证才算通过
- **E2E / Playwright 精准跑（强制，禁止全量）**：
  - **禁止裸全量**：**不得在 VERIFY 阶段运行全量 e2e 套件**（裸 `playwright test` 全量：48 spec/130 tests → 3.7min + 128 did-not-run 雪崩跳过）；全量 e2e 仅允许 CI/发布前跑
  - **精准范围**：只跑与本次改动相关的 spec——
    - 按改动文件匹配：改了 `web/.../views/archive/config/file-*` → 跑 `e2e/modules/archive/file-registration-*.spec.ts`，或精确到 `playwright test e2e/modules/archive/file-registration-<id>.spec.ts`
    - 或按 bug 标签：`playwright test --grep "@bug-893"`
  - **回归脚本仍然必跑**：`node scripts/test-bug-<bug-id>.mjs`（0.08s，保留，不因精准跑而省略）
  - **保留现有门禁**：`test_db_url` 真实库、编译门禁、操作路径穷举门禁、E2E 编写规范（复用 `e2e/common` 不裸 `waitForTimeout`；视觉验证据视觉 subagent `qwen3`/`gpt-5.5`）
  - **跨模块重构**：若改动确实影响多个模块，需列出涉及的所有相关 spec 名并说明为何需要（非默认全量）
- **编译门禁**（强制，缺一不可）：
  - 运行 `AI_WORKSPACE.md` 定义的构建命令，按本次改动影响的模块选择：
    - 后端 → `build_cmd`（如 `mvn compile` / `gradle build`）
    - 前端 → `web_build_cmd`（如 `npm run build`）
    - app → `app_build_cmd`
  - **编译失败则不能 advance**，必须先修复再回到本 Phase
  - 若 `AI_WORKSPACE.md` 未配置对应构建命令：按模块约定推断（Java → `mvn compile` / `gradle build`；Node → `npm run build`）；仍无法确定时，在 evidence 记录**豁免原因**（写明"未执行编译验证"及理由）后才能 advance

### 操作路径穷举门禁（强制）

- **操作路径穷举清单（强制）**：列出 bug 步骤涉及的每个操作路径（提交/删除/合并/解析/格式转换/回滚/校验/对比/…），逐个标注 `✅已验证` 或 `❌不在本次范围`。
- 修"X 操作"类 bug 时，穷举该场景/模块的所有同类操作，确认没有遗漏同类修改（896 教训：只修了提交路径，遗漏 resolve/删除/格式转换等同路径）。
- **resolve 路径门禁**：resolve 必须关联 bug 描述中的操作路径（resolve 前 `已验证路径数 > 0` 才允许 resolve，否则补验证并标注"人工复核"）。
- 对每条"✅已验证"路径给出**具体验证命令/产物**（接口调用/回归脚本/E2E 证据），不能只靠代码阅读断言。

### 并行验证（review 通过后可启用）

> 适用场景：连续处理多个 bug 时，VERIFY 的 playwright 测试是耗时瓶颈（实测全量 48 spec/130 tests ≈ 3.7min + 128 did-not-run 雪崩）。review 通过后，可把 playwright 测试派给后台 subagent 执行，主线程并行推进下一 bug 的前置分析。

- **阶段关系**：FIX → review 通过后，VERIFY 的 playwright 测试**允许派后台 subagent 执行**（`run_in_background: true`）；主线程**同时**开始下一 bug 的 INTAKE/ANALYZE（见 worker 并行约束）。
- **并行窗口限制（铁律）**：主线程并行期只允许做「纯读分析」——读代码、读 bug spec、写 proposal/tasks 草稿、读仓库结构；**禁止进入 FIX 改代码/重启服务**——否则 vite 热重载会打断后台测试，导致整轮空跑（后台 playwright 因 dev server 重启而失败/超时，必须重跑）。
- **测试结果回收**：后台 playwright 完成后，主线程**收到结果才可**进入下一 bug 的 FIX 阶段；用 `playwright test --reporter=json` 落盘测试结果（如 `test-results/playwright-results.json`）供 evidence 引用（verify-bc 门禁的 `.last-run.json` status=passed 仍是正式依据）。
- **失败处理**：后台跑出的失败 → 记录到 evidence（失败 spec 名 + 错误摘要）；可选 `playwright test --last-failed` 快速重跑失败项，通过后再 advance。

> TODO（后续 change）：代码侧 `verify --async` 命令——输入 changeId → git diff 自动定位相关 spec → 后台执行 playwright → 结果写 jsonl/evidence → retrieval 读取后台结果。本 change 仅文档化并行验证流程，命令落地留待后续 change。

- 全部通过后 `aiws bugfix advance bugfix-<bug-id>` → REVIEW

## PHASE 6 — REVIEW（代码审查 + 禅道回填）

- `$ws-review` 审计改动，review 文件落盘
- review 通过后、advance 前执行**禅道回填（resolve_bug）**：
  1. 从 `bug/zentao-bug-<id>.json` 和 evidence 提取 `solutionModules`（JSON 结构）：
     ```json
     {
       "rootCause": "【根因】详细根因分析",
       "fixApproach": "【修复思路】选择当前修复方案的理由，不涉及备选方案",
       "logicChange": "【改动逻辑】改了什么文件、改了什么逻辑",
       "impact": "【影响范围】改动可能影响的功能模块"
     }
     ```
     - 各字段多行文本（`\n` 拼接）以适配禅道视图
     - `impact` **不得**写"无"——至少写"影响范围有限，仅限于修复的功能模块"
     - 不写 Evidence:/Verify: 标签
  2. 调 Zentao MCP `resolve_bug`（携带完整 `solutionModules` JSON；`resolvedBuild` 默认取环境变量 `ZENTAO_DEFAULT_RESOLVED_BUILD`，未设置时回退 `"trunk"`）
  3. 如适用：`git push` 推送修复分支
- 全部通过后 `aiws bugfix advance bugfix-<bug-id>` → COMMIT

> ⚠️ advance 前执行 REQ SYNC **增量复核**（主判定已在 PHASE 2 ANALYZE 出口完成；修复落地后如产生新增需求影响则补同步，否则沿用 ANALYZE 判定）。详见 [REQ_SYNC_GATE.md](REQ_SYNC_GATE.md)。

## PHASE 7 — COMMIT

- `aiws commit`（校验 + 提交）

## PHASE 8 — PUSH

- `aiws push`

## PHASE 9 — FINISH

- `aiws change finish bugfix-<bug-id> --push`（合并回目标分支 + 归档）
- 回填 `issues/fix_bus_issues.csv`
- `aiws bugfix advance bugfix-<bug-id>` → DONE

## PHASE 10 — DONE

- 输出修复摘要：bug-id、根因、改动、验证结果、禅道状态