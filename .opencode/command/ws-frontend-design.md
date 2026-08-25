---
description: 前端设计：视觉优先的 UI/UX 实现，先信息层级与构图，再组件细节
---
<!-- AIWS_MANAGED_BEGIN:opencode:ws-frontend-design -->
# ws frontend design

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在 AIWS 约束下交付可运行、可验证、视觉方向明确的前端界面。先信息层级与构图，再组件细节。品牌页重视觉锚点，产品页重可操作性。

前置：
1) 运行 `$ws-preflight` 读取真值文件。
2) 判断任务类型：`landing`（品牌/营销）| `app-ui`（dashboard/工具）| `polish-only`（仅视觉提质）。
3) medium/complex 任务先用 `$ws-plan` 落盘计划。

详细设计指令见对应的 SKILL.md 文件：`skill(name="ws-frontend-design")`
<!-- AIWS_MANAGED_END:opencode:ws-frontend-design -->
