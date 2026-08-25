---
description: 轻量开发：simple/local 单点修复；最小改动 + 最小验证
---
<!-- AIWS_MANAGED_BEGIN:opencode:ws-dev-lite -->
# ws dev lite

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：处理 simple/local 单点修复，走最小改动 + 最小验证，不默认拉起完整重流程。

使用条件：
- 目标明确、归因明确、验证入口明确
- 一般只影响单文件或紧密相关的小范围文件
- 不需要先改 `REQUIREMENTS.md`

强制流程：
1) 先运行 `/ws-preflight`。
2) 先说明：
   - `Goal:`
   - `Why lite:`
   - 若说不清，立刻回到 `/ws-dev` 或 `/ws-plan`
3) 实施最小改动；不要为形式完整额外扩 scope。
4) 运行最小可复现验证；允许比全量更窄，但必须说明为什么足够。
5) 输出 `Changed / Verify / Evidence / Next`。
6) 若准备提交或交付：后续仍进入 `/ws-review`、`aiws commit`、`/ws-finish`。

边界：
- 默认不创建 `plan/...`
- 默认不跑 `aiws plan-verify`
- 默认不要求先做双 review
- 一旦复杂度升高，停止 lite，切回主流程
<!-- AIWS_MANAGED_END:opencode:ws-dev-lite -->

可在下方追加本项目对 OpenCode 的额外说明（托管块外内容会被保留）。
