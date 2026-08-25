---
name: ws-rule
description: 使用时机：需要了解项目规则、边界、约束时。触发词：规则、边界、约束、规范、约定。注意：只查询不改代码。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：把用户口述的“项目特有规则”整理成可执行条款，并写入 `AI_PROJECT.md` 的 `AI_PROJECT_RULES_BEGIN/END` 段（托管块外内容会被保留）。

安全规则（强制）：
- 不打印/不写入 secrets（token、密钥、内网地址、账号密码）。
- 不执行破坏性命令。

工作流：
1) 先做 preflight；若缺失 `AI_PROJECT.md`：提示用户先 `aiws migrate`（或 `$aiws-init`）。
2) 写入前创建备份（必须）：
`ts="$(date +%Y%m%d-%H%M%S)"; mkdir -p .aiws/backups/manual; cp -a AI_PROJECT.md .aiws/backups/manual/AI_PROJECT.md.bak.${ts}`
3) 先输出“将写入的规则清单”（3–12 条），并要求用户回复 `CONFIRM` 后再落盘。
4) 用户确认后，**仅更新** BEGIN/END 段内内容（合并去重；写成可检查条款：目录白名单/必须验证命令/禁止项/产物要求）。
5) 输出必须包含：
   - 更新了哪些文件（路径）
   - 回滚方式（恢复备份文件）
   - 下一步建议：`$aiws-validate`

## 完成判定

- 规则清单已获用户 `CONFIRM` 并仅写入 `AI_PROJECT.md` 的 `AI_PROJECT_RULES_BEGIN/END` 段；备份已创建（`.aiws/backups/manual/`），输出含回滚方式。
