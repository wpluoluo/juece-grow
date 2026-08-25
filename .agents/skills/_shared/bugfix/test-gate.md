## 5) 测试验证门禁

本步骤根据改动文件所属模块，自动选择对应的测试命令执行。**测试未通过则 Fix_Status 不能设为 DONE。**

### 5.1 识别改动范围

```bash
CHANGED_FILES=$(git diff --name-only $(git merge-base HEAD main)..HEAD --)
echo "$CHANGED_FILES"
```

根据输出判断：
- `packages/aiws/` 下有改动 → **CLI 模块**（核心）
- `packages/spec/` 下有改动 → **规范/模板模块**
- `scripts/` 下有改动 → **工具脚本模块**
- 多个目录有改动 → **全模块测试**

### 5.2 执行测试

```bash
# 全量测试（含所有 sync-check + 单元 + 模板投影 + router 用例）
npm test
```

若改动范围明确且测试耗时较长，可定向执行：

```bash
# 仅 CLI 测试
npm run build -w packages/aiws && npm run test -w packages/aiws

# 仅模板一致性检查
node scripts/test-template-projection-consistency.mjs

# 仅 workflow router 用例
node scripts/test-workflow-router-cases.mjs

# 仅 governance gates
node scripts/test-governance-gates.mjs
```

依赖：
- `npm install` 已执行
- 构建已完成（`npm run build -w packages/aiws`）

### 5.3 测试证据落盘

无论成功或失败，将测试输出保存为证据：

```bash
mkdir -p .aiws/changes/<change-id>/bug/test-reports/
npm test 2>&1 | tee .aiws/changes/<change-id>/bug/test-reports/test-output-<bug-id>.log
{
  echo "# Test Report for Bug <bug-id>"
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "Changed files:"
  echo "$CHANGED_FILES"
} > .aiws/changes/<change-id>/bug/test-reports/summary-<bug-id>.md
```

### 5.4 阻断规则

- **测试失败** → `Fix_Status = BLOCKED`，不允许进入结构验证
- **测试环境不具备**（node_modules 未装等）→ 在 `Notes` 写明，`Fix_Status` 保留 `DOING`
