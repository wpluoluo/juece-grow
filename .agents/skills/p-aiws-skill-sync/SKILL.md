---
name: p-aiws-skill-sync
description: 私有：同步上游 skill 到模板 .agents/skills/ 目录。使用时机：gitea 上游 skill 更新后，需要把新版本同步进 aiws 模板时。触发词：同步 skill、skill sync、vendor 更新、上游更新。
disable-model-invocation: true
---

目标：
- 将 gitea 上游仓库的最新 skill 同步到本仓库模板 `packages/spec/templates/workspace/.agents/skills/`
- 保持模板与上游版本一致，供 `aiws init/update` 投影到下游项目

同步源（真值，见 `AI_PROJECT.md` §9）：
- `https://gitea.aipper.de/github/skills`（工程工作流 pipeline）
- `https://gitea.aipper.de/github/taste-skill`（前端设计 taste 库）

执行（在仓库根目录）：

1. **拉取上游最新**（用临时目录，不污染工作区）：
```bash
rm -rf /tmp/aiws-skill-sync && mkdir -p /tmp/aiws-skill-sync
git clone --depth 1 https://gitea.aipper.de/github/skills /tmp/aiws-skill-sync/skills
git clone --depth 1 https://gitea.aipper.de/github/taste-skill /tmp/aiws-skill-sync/taste-skill
```

2. **对比差异**：找出上游有、模板没有 / 内容不同的 skill：
```bash
# skills 源（工程工作流）→ 模板 .agents/skills/
for src in skills taste-skill; do
  echo "== $src 源差异 =="
  for d in /tmp/aiws-skill-sync/$src/*/; do
    name=$(basename "$d")
    if [ ! -d "packages/spec/templates/workspace/.agents/skills/$name" ]; then
      echo "  新增: $name (来自 $src)"
    elif ! diff -rq "$d" "packages/spec/templates/workspace/.agents/skills/$name" >/dev/null 2>&1; then
      echo "  变更: $name (来自 $src)"
    fi
  done
done
```
3. **同步**：确认差异后，复制上游到模板（保持完整目录结构）：
```bash
# 对每个新增/变更的 skill（<source> 是 skills 或 taste-skill）：
rm -rf packages/spec/templates/workspace/.agents/skills/<name>
cp -r /tmp/aiws-skill-sync/<source>/<name> packages/spec/templates/workspace/.agents/skills/<name>
```

4. **更新 manifest**：`.agents/skills/**` glob 已覆盖全部 skill，无需逐条新增。但若删除了 skill 目录，检查 `update.remove` 是否需要补充删除项。

5. **更新同步源记录**：
   - `packages/spec/docs/skill-manifest.json` 的 pinnedCommit 更新为上游 HEAD
   - `AI_PROJECT.md` §9 S3 的 pinnedCommit 记录同步更新

6. **验证**：
```bash
ls packages/spec/templates/workspace/.agents/skills/ | wc -l   # 期望：97（96 + p-aiws-skill-sync 自身）
bash scripts/check-skill-template-drift.sh                       # All skills synced
./node_modules/.bin/aiws validate .                             # ✓
```

约束：
- **只改模板源** `packages/spec/templates/workspace/.agents/skills/`；不直接改下游项目
- 不覆盖本地定制：若某 skill 在本仓库有定制（与上游有意不同），同步前先确认是否保留定制
- 删除 skill 需谨慎：确认无其他 skill/文档引用后再删

## 完成判定

- 上游 skill 已同步到模板 `.agents/skills/`
- manifest + AI_PROJECT.md §9 的 pinnedCommit 已更新
- `ls ... | wc -l` 数量符合预期，`aiws validate .` 通过