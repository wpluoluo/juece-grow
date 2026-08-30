---
title: GATE-004 安全加固已归档
created: '2026-08-30T08:30:57.317Z'
updated: '2026-08-30T08:31:04.692Z'
summary: >-
  GATE-004 安全加固（commit 8ed1dab，已推送 gitee/main）：后台鉴权全收敛为项目隔离 Access 函数（Users adminOnly / Leads leadScopedWrite /
  Memberships membershipScopedManage / Projects projectManage），防跨项目建账/改删/搬家/越权分配；新增公开内容面 ...
tags:
  - security
  - auth
  - webhook
  - gate-004
---
GATE-004 安全加固（commit 8ed1dab，已推送 gitee/main）：后台鉴权全收敛为项目隔离 Access 函数（Users adminOnly / Leads leadScopedWrite / Memberships membershipScopedManage / Projects projectManage），防跨项目建账/改删/搬家/越权分配；新增公开内容面 /api/v2/content/articles（跨端隔离+白名单投影），原生 REST 匿名收敛 403；文章 sanitize 白名单+JSON-LD/RSS 转义防 XSS；Chatwoot webhook 鉴权改 Authorization Bearer 头（恒时比较）+C7 用例；提醒判重 H4 语义澄清；PAYLOAD_SECRET 缺失即 throw。关键决策：权限收敛用 Access 函数而非 beforeChange 钩子（因 webhook/内部级联 overrideAccess 无 user 调用，钩子会连坐）。新增安全测试套件 apps/e2e/tests/security.spec.ts（C1-C7）。
