# REQ SYNC GATE — 硬阻断

进入 FIX 前（PHASE 2 ANALYZE 出口、advance 前的门禁），**必须**执行需求同步**主判定**。

> **为什么前置（O-01，156 实战教训）**：REQ SYNC GATE 原先在 COMMIT 前（PHASE 6 出口）执行，
> 真值补写（`REQUIREMENTS.md` + CHANGELOG + 台账）常被串行塞进 fix 阶段尾部，拖累 fix 耗时
> （bugfix-1042 fix=134.7m：task-3 真值补写 14:23 才完成判定、14:32 才进 test/verify）。
> 根因与影响面在 ANALYZE 段已明确——需求真值应在此时同步，fix 阶段只做实现+验证。
>
> COMMIT 前保留**增量复核**：修复落地后若产生新增需求影响（新字段/新接口行为/新状态码等），
> 补同步；否则沿用 ANALYZE 出口的判定，不重复全量流程。

## 检查步骤

1. 对比本次修复涉及的 API 行为、接口字段、错误信息是否与 `REQUIREMENTS.md` 当前描述一致
2. 若存在偏差（例如：bug 暴露了需求描述不准确、修复改变了接口行为、新增了字段/状态码等）：
   - 运行 `$ws-req-change` 更新 `REQUIREMENTS.md`
   - 或记录到 `requirements/CHANGELOG.md`
3. 输出 `REQ_SYNC:` 状态

## 状态输出

| 状态 | 含义 | 动作 |
|------|------|------|
| `SYNCED` | 已同步（REQUIREMENTS.md 已更新） | ✅ 允许 advance → FIX |
| `NOT_NEEDED` | 本次修复不影响需求描述 | ✅ 允许 advance → FIX |
| `BLOCKED` | 应更新但未更新 | ❌ 阻断进入 FIX |

只有 `REQ_SYNC` 为 `SYNCED` 或 `NOT_NEEDED` 时，才能 `aiws bugfix advance bugfix-<bug-id>` → FIX。

## COMMIT 前增量复核

- **时机**：PHASE 6 REVIEW 通过后、advance → COMMIT 前（v1 语义中该处为硬门禁主判定；O-01 后仅做增量复核，不重复全量补写）。
- **动作**：若修复落地引入了 ANALYZE 判定之后才出现的新需求影响（字段/BEHAVIOR/状态码变化），
  走 `$ws-req-change` / CHANGELOG 补同步并保持 `SYNCED`；无新增影响则沿用 ANALYZE 出口判定。
- **门禁**：复核判定仍须为 `SYNCED` 或 `NOT_NEEDED` 才能 advance → COMMIT。