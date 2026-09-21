---
title: astro-page-copy-cms 规划定案：方案 B + 唯一读接缝 + 位置耦合锁长度
created: '2026-09-20T10:30:02.956Z'
updated: '2026-09-20T10:30:02.958Z'
summary: >-
  Astro 页面文案入 CMS（REQ-0003 / change astro-page-copy-cms）规划定案，owner 2026-09-20 裁决方案 B 打底：每页一个结构化 Payload 集合（page-home /
  page-features / page-solutions / page-pricing），字段与 apps/astro/src/content/{home,...
tags:
  - astro
  - payload
  - cms
  - plan
  - req-0003
---
Astro 页面文案入 CMS（REQ-0003 / change astro-page-copy-cms）规划定案，owner 2026-09-20 裁决方案 B 打底：每页一个结构化 Payload 集合（page-home / page-features / page-solutions / page-pricing），字段与 apps/astro/src/content/{home,features,solutions,pricing}.ts 的 TS 类型一比一，不建通用 PageBlocks 区块表。关键取舍：(1) 页面身份=集合身份，四个 TS 类型都没有 id/slug，故不造标识字段，站归属用 project relationship + beforeChange 令同集合内 project 唯一；(2) 有序性用 Payload 数组索引序，不存 sortOrder 列（与索引表达同一事实＝双写），仅首页 hero.titleLines/hero.stats/cta.rows 放开增删排序，位置耦合的 hero.diagram.chips 锁 3、nodes≤3、cases.minis≤2（渲染器 index.astro:146-148、92+i*112 固定 viewBox、['A','B'][i] 会静默丢内容）；(3) 唯一读接缝 GET /api/v2/content/pages，site 必填且无 juece 默认（不同于 articles/route.ts:84），未发布即 404，Astro 侧 getPageCopy 抛错=构建非零；(4) 发布形态沿用仓内 status select，不引入 versions/drafts/livePreview（全仓零命中）；(5) 规模实测 ≈1171 个文本单元（1374 个 leaf 字符串减 203 结构键），导入前必须先把 12 份 (site,page) JSON dump 与三站四页渲染文本基线落到 evidence/snapshot-pre-import/ 作回滚与逐字比对依据；(6) 去 SITE_ID 兜底必须与 apps/astro/package.json 的 dev/build 显式 cross-env SITE_ID=juece 同批，因为 .env 实测没有 SITE_ID 键、只删代码会把根 build.mjs:48 与 e2e 前置打红。范围外：法务页/404/feed/文章 JSON-LD 的品牌硬编码 7 处登记为 PROB-023 另立轻量 change；顺带登记的 PROB-024（features.astro:127 拼出 cap-tagyb 而 CSS 是 .cap-tag.yb，三站各中一处）在本 change 内修，避免把缺陷固化进 CMS 数据。门禁实测：plan-verify / validate . / change validate --strict [--check-scope] 均 exit=0，--check-evidence exit=2（规划轮本无证据）。
