---
title: astro-page-copy-cms 交付定案：方案 B 四集合、构建期硬失败、台账与归档三审计器分工
created: '2026-09-21T00:14:44.642Z'
updated: '2026-09-22T03:27:25.065Z'
summary: >-
  Astro 页面文案入 CMS 交付轮定案（change astro-page-copy-cms，已于 2026-09-22 归档关闭：main 上依次为 0872bd0 代码与证据、1c530a4 文档、3242886 与
  f1ed394 两次 memory-bank、752d626 P15 台账与收口链、e7446f2 finish bookkeeping、c41fe86 归档搬运；gi...
tags:
  - astro
  - payload
  - cms
  - delivery
  - req-0003
---
Astro 页面文案入 CMS 交付轮定案（change astro-page-copy-cms，已于 2026-09-22 归档关闭：main 上依次为 0872bd0 代码与证据、1c530a4 文档、3242886 与 f1ed394 两次 memory-bank、752d626 P15 台账与收口链、e7446f2 finish bookkeeping、c41fe86 归档搬运；gitee/main 已到 c41fe86，origin（GitHub）当日整机不可达故仍落后，网络恢复后 git push origin main 即可，不改变任何结论）。实现即规划方案 B：四个 Payload 集合 page-home / page-features / page-solutions / page-pricing 字段一比一对齐原 TS 类型，旧 content 四文件已删，读路径唯一，无双写无兜底；首页 hero.titleLines / hero.stats / cta.rows 放开后台增删排序，位置耦合的 hero.diagram.chips 锁 3、nodes 锁 ≤3、cases.minis 锁 ≤2。三条交付期新定案：(1) 建表与 project 唯一索引不能指望 Payload 自动迁移——本库走显式 migrate 与 psql，新索引必须先核名冲突再应用，否则写路径与读路径都不认它；(2) 构建期硬失败已双向证伪过：缺 SITE_ID 与指向死端口两次都让 astro build 非零（负向构建先红后绿），自助改稿走后台页面而非直接 SQL；(3) 客户端 bundle 不得内联 CMS Origin，由门禁扫描产物保证。推送门禁按流程执行：L3 深度安全审查对已提交改动 0 发现，之后才 push。证据机制定案：验收台账 evidence/verification.jsonl 由 append-verification-pN.mjs 逐轮追加（行数与 appender 只数随轮增长，刻意不写死——上一版写成 406 行 / 21 只，下一轮入账后即过期）；每一份编号执行日志都按 sha256 镜像进 evidence/logs/ 使换 clone 后仍可复核（镜像份数随轮增长、不作为口径写死，终局判据是那只从磁盘反查的审计器报 归档缺字节=0）；三只审计器分工为正向（appender 行 ⊆ 台账）、反向（台账 ⊆ appender）、以及从磁盘日志反查台账与归档的那只。必须保留的口径：台账覆盖的是可复现的验收判定，不是执行过的每一条命令，任何覆盖率 100% 的说法都不成立；编号日志的正则必须允许字母后缀（236b、447b、463b 曾被只认数字加连字符的写法静默漏掉）；退出码必须由命令自身落进日志、不过管道，抛错运行若没落 exit 行就不许凭记忆补；带自己日志的运行永远看不到自己的字节，所以缺字节归零那条判据只能由一次不落日志的运行给出。aiws change finish --push 的自锁（本轮实测并据此收尾）：它把「合并进 main + bookkeeping 提交 + push」排在前面，把「tasks 全勾才归档」排在后面，而收尾任务（4.3）的内容恰恰包含 finish 本身 ⇒ 不 --force 它永远进不了归档。定案是不跳门：勾掉收尾任务后单独跑 aiws change archive <id>（该子命令不带 tasks 门）完成搬运，再手工提交搬运 diff（实测为 571 条 rename + 1 条新增 handoff.md、change 树外零改动）。归档即工具终点：append-verification-pN.mjs、481 镜像、448 反查都写死 .aiws/changes/<id>/… 路径，搬运后不可重跑 ⇒ 所以补账必须排在推送与归档之前；归档后本轮尾部日志的字节已入库、台账行确定不再补登（不是丢失），日后若续登须先把这三只工具改指 .aiws/changes/archive/<date>-<id>/。遗留分组：PROB-023 品牌硬编码另立轻量 change；PROB-039 / 041 / 045 属同一次基线退役动作，不可拆做；PROB-035 至 040 与 042 至 044 仍 OPEN；线上迁移与内容导入仍按 evidence/release-prerequisites.md 由人工择期，不开维护窗口。
