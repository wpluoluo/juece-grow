---
name: ws-frontend-design
description: 使用时机：需要前端设计、UI/UX 实现时。触发词：设计、前端、UI、页面、视觉、界面。注意：非视觉实现请用 ws-dev。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在 AIWS 约束下交付可运行、可验证、视觉方向明确的前端界面。先信息层级与构图，再组件细节。品牌页重视觉锚点，产品页重可操作性。

非目标（强制）：不绕过 `$ws-preflight` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`；不因"追求设计感"重写无关页面或新增大面积依赖；不默认改产品后台为营销页；不把 prompt 语言/设计说明/占位废话写进 UI。

适用场景：landing / 品牌站 / 活动页 / marketing / demo / prototype / game UI；或把现有界面提质为"视觉主导、层级清晰"的版本。

前置：
1) 运行 `$ws-preflight`。
2) 判断任务类型：`landing`（品牌/营销）| `app-ui`（dashboard/工具）| `polish-only`（仅视觉提质）
3) 判断设计边界：`net-new`（全新视觉）| `existing-system`（优先复用已有规范）
4) medium/complex：先用 `$ws-plan` 落盘计划。

编码前先写三项（不要跳过）：
- `Visual thesis:` 一句话 mood / material / energy
- `Content plan:` hero → support → detail → final CTA（app-ui：workspace → nav → context → action）
- `Interaction thesis:` 2-3 个动效想法及其如何改善层级/氛围/可感知性

## 设计默认值
- 构图优先于组件库；第一屏偏海报感，非文档感
- 强视觉锚点：大图 / 主视觉平面 / 产品画面 / 主数据工作区
- 避免卡片墙；用 section / column / divider / media / list / plain layout
- ≤两套字体、一种强调色（有品牌系统则跟随）；靠留白、尺度、裁切、对比、对齐建层级

## Landing 规则
结构：Hero（名/承诺/CTA/主视觉）→ Support（能力/证明）→ Detail（氛围/流程/故事）→ Final CTA
Hero：每 section 一个 dominant idea；默认 full-bleed（仅文字区限宽）；品牌名 > headline > body > CTA
禁止：hero cards / stat strips / logo clouds / pill soup / floating dashboards
headline desktop 约 2-3 行、mobile 一眼读完；header+hero 不超 viewport；主视觉去掉后首屏仍成立=图像太弱

## App-UI 规则
- 克制：少色、少 chrome、清晰栅格、可扫读；primary workspace → nav → secondary context → action
- card 仅作交互容器，否则 plain layout；勿把产品 UI 做成营销页
- 文案偏 orientation / status / action；忌口号 / 情绪隐喻 / 摘要横幅

## 图像与媒体
- 图像必须承担叙事任务，不能只是补背景
- 品牌页/空间页优先真实感强的图，不是抽象 3D / 假 dashboard
- 选图时优先有稳定明暗区，便于文字落位；避免自带的抢戏 logo / signage / 碎字
- 若需多个场景，多张图优于拼贴大杂烩

## 文案
- 用产品语言，不用设计评论语言
- headline 负责主要意义；supporting copy 通常一句话足够
- 每个 section 只负责一件事：explain / prove / deepen / convert
- 如果删掉 30% 后更清楚，就继续删

## 动效
- 视觉型页面至少 2-3 个"有感但克制"的动效：
  - 一个 hero 入场序列
  - 一个 scroll-linked / sticky / depth 效果
  - 一个 hover / reveal / layout transition
- 动效必须改善层级或氛围，不能只是热闹
- 兼顾 mobile 流畅度；支持 `prefers-reduced-motion`

## 工程约束（强制）
- 先读现有代码；`existing-system` 下优先复用视觉语言，不无故"整站改头换面"
- 不新增字体/图片/动画库/运行时依赖，除非写明原因、来源、license 与回滚方式
- 图像上的文字必须保证对比度与点击区域可用
- 必须同时考虑 desktop / mobile；验证命令优先引用 `AI_WORKSPACE.md`

## 实现检查（交付前）
- 首屏品牌/锚点明确；扫标题即可懂页；每 section 单一职责
- card 有必要；动效真提升层级；去装饰阴影后页面仍成立

## 输出要求
- `Mode:` `landing | app-ui | polish-only`
- `Visual thesis:` 一句话
- `Changed:` 改动文件清单
- `Verify:` 实际运行命令 + 预期结果
- `Evidence:` `plan/...`、`.aiws/changes/<change-id>/...` 或截图/审计路径

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`

## 完成判定

- 输出含 `Mode:` / `Visual thesis:` / `Changed:` / `Verify:` / `Evidence:` 五项，`Verify:` 为实际运行命令且通过，实现检查（首屏锚点/单职责/动效必要性）全部满足。
