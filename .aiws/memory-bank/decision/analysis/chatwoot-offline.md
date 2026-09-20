---
title: Chatwoot Offline
created: '2026-08-31T04:46:36.169Z'
updated: '2026-08-31T04:46:36.171Z'
summary: >-
  Chatwoot 访客端显示「当前已离线」为后台客服在线状态问题，非代码缺陷。浮窗能显示该提示语即证明 SDK 与后端连通正常。根因=收件箱无在线客服账号或 inbox availability 为 offline。处置：登录
  chat.juece.cloud 保持客服在线+inbox 切 online；离线留言仍经 webhook message_created 写回自有线索池不丢失。代码...
disclosure: boot
---
Chatwoot 访客端显示「当前已离线」为后台客服在线状态问题，非代码缺陷。浮窗能显示该提示语即证明 SDK 与后端连通正常。根因=收件箱无在线客服账号或 inbox availability 为 offline。处置：登录 chat.juece.cloud 保持客服在线+inbox 切 online；离线留言仍经 webhook message_created 写回自有线索池不丢失。代码位点 apps/astro/src/layouts/Layout.astro#L285-L292。
