---
title: astro-page-copy-cms 交付定案：单一读路径 + 迁移需显式应用 + 台账与日志归档口径
created: '2026-09-21T00:14:44.642Z'
updated: '2026-09-21T00:18:05.706Z'
summary: >-
  Astro 页面文案入 CMS 交付轮定案（change astro-page-copy-cms，2026-09-21 本地提交 0872bd0，未推送、未 finish）。实现即规划方案 B：四个 Payload 集合
  page-home / page-features / page-solutions / page-pricing 字段一比一对齐原 TS 类型，旧 content 四文件...
tags:
  - astro
  - payload
  - cms
  - delivery
  - req-0003
---
Astro 页面文案入 CMS 交付轮定案（change astro-page-copy-cms，2026-09-21 本地提交 0872bd0，未推送、未 finish）。实现即规划方案 B：四个 Payload 集合 page-home / page-features / page-solutions / page-pricing 字段一比一对齐原 TS 类型，旧 content 四文件已删，读路径唯一，无双写无兜底；首页 hero.titleLines / hero.stats / cta.rows 放开后台增删排序，位置耦合的 hero.diagram.chips 锁 3、nodes 锁 ≤3、cases.minis 锁 ≤2。三条交付期新定案：(1) 建表与 project 唯一索引不能指望 Payload 自动迁移——本库走显式 migrate 与 psql，新索引必须先核名冲突再应用，否则写路径与读路径都不认它；(2) 构建期硬失败已双向证伪过：缺 SITE_ID 与指向死端口两次都让 astro build 非零（负向构建先红后绿），自助改稿走后台页面而非直接 SQL；(3) 客户端 bundle 不得内联 CMS Origin，由门禁扫描产物保证。证据机制定案：验收台账 evidence/verification.jsonl 406 行由 21 只 appender 逐轮追加；每一份编号执行日志都按 sha256 镜像进 evidence/logs/ 使换 clone 后仍可复核（镜像份数随轮增长、不作为口径写死，终局判据是那只从磁盘反查的审计器报 归档缺字节=0）；三只审计器分工为正向（appender 行 ⊆ 台账）、反向（台账 ⊆ appender）、以及从磁盘日志反查台账与归档的那只。必须保留的口径：台账覆盖的是可复现的验收判定，不是执行过的每一条命令，任何覆盖率 100% 的说法都不成立；编号日志的正则必须允许字母后缀（236b、447b、463b 曾被只认数字加连字符的写法静默漏掉）；退出码必须由命令自身落进日志、不过管道，抛错运行若没落 exit 行就不许凭记忆补；带自己日志的运行永远看不到自己的字节，所以缺字节归零那条判据只能由一次不落日志的运行给出。遗留分组：PROB-023 品牌硬编码另立轻量 change；PROB-039 / 041 / 045 属同一次基线退役动作，不可拆做；PROB-035 至 040 与 042 至 044 仍 OPEN。推送前须过 L3 深度安全审查并获 owner 明确确认，memory-bank 按裁决单独提交。
