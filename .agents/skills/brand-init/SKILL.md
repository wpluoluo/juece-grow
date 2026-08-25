---
name: brand-init
description: 使用时机：需要初始化或维护项目的品牌配置（子模块到分支的映射）时。触发词：品牌、brand、profile、多品牌、子模块映射。注意：仅负责写 aiws/brands.yml，不直接改子模块。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：把用户口述的"品牌 → 子模块 → 目标分支"映射整理成 `aiws/brands.yml`（版本化、可审计）。品牌信息在此 skill 中持久化，后续 session 通过 `brands.yml` 读取绑定，无需重复询问。

## 安全规则（强制）

- 不打印/不写入 secrets（token、密钥、内网地址、账号密码）。
- 不执行破坏性命令（不 checkout、不 switch、不 reset）。
- 不改动任何子模块的当前状态；本 skill 只写配置文件。

## 输出格式（唯一真值）

`aiws/brands.yml`，位于项目根：

```yaml
# aiws/brands.yml
brands:
  ly:
    display: "LY Consultancy"
    submodules:
      app: ly
      cabinet: ly
      webbase: main
  default:
    display: "Default (Maintainer)"
    submodules:
      app: js
      cabinet: main
      webbase: main
```

- `brands` 下每个 key 是品牌名（小写、无空格）。
- `display`：人类可读品牌名（可空）。
- `submodules`：子模块名 → 目标分支名。子模块名必须来自 `.gitmodules` 的 `[submodule "…"]`。
- 只有一个品牌时也照常写（单一品牌场景：`brands: { default: { submodules: … } }`）。

## 执行步骤

### 1. Preflight

- 确认项目根（存在 `.git`）。
- 读 `.gitmodules`，列出所有子模块名。若不存在 `.gitmodules`，提示用户"此项目无子模块，品牌配置不适用"，停止。
- 若已存在 `aiws/brands.yml`：先读出来，作为对话预填（diff 模式：只问变更部分），不整体重问。

### 2. 对话收集

逐品牌逐子模块询问：

1. "这个项目有几个品牌？"（品牌名列表）
2. 对每个品牌："品牌 `<name>` 下，子模块 `<m1>`、`<m2>`、… 分别走哪个分支？"（可给默认值：未指定的子模块回退 `main`）
3. 品牌 display 名（可留空）

所有子模块都必须有归属；未提及的子模块默认 `main`，并在写入前明确告知用户。

### 3. 写入前确认

- 先输出"将写入的 brands.yml 清单"（完整 YAML 预览）。
- 要求用户回复 `CONFIRM` 后再落盘。
- 写入前创建备份（必须）：
  `ts="$(date +%Y%m%d-%H%M%S)"; mkdir -p .aiws/backups/manual; cp -a aiws/brands.yml .aiws/backups/manual/brands.yml.bak.${ts}`

### 4. 写入

写 `aiws/brands.yml`，严格按上面格式。合并去重：与已有配置对比，只更新变更部分。

### 5. 输出必须包含

- 更新了哪些文件（路径）
- 回滚方式（恢复备份文件）
- 下一步建议：告诉用户"下次开 session 时说出品牌名（如 '用 ly 品牌'），intake 阶段会自动从 brands.yml 绑定子模块分支"

## 不做的事

- 不修改 `.gitmodules` 或子模块的 `branch` 字段。
- 不执行任何 git submodule 操作。
- 不生成 `submodule-profiles/*.targets`（旧格式，若有可保留作后向兼容，但本 skill 不写）。
