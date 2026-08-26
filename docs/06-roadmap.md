# juece-grow · 路线图（分阶段交付）

> 每个阶段以可交付、可验证的产物为准。先跑通再扩展。

## Phase 1 · 跑通链路
目标：能搭一个站点、发文章、收表单线索。

- [ ] 立门禁：docs/gates/GATE-001-phase1-skeleton.md（方案对比+风险+影响范围）确认后开工
- [ ] 初始化工程骨架：Astro(公开站) + Payload 3 + PostgreSQL，单仓库 apps/astro + apps/cms
- [ ] Payload 内建 Auth：邮箱密码 + JWT/Cookie，注册/登录
- [ ] 项目 + 站点 + 页面 + 区块的基础 CRUD（Payload collections）
- [ ] 公开站点模板渲染（首页/文章/落地页）
- [ ] 文章管理 + Payload Lexical 富文本
- [ ] 表单 + FormSubmission → Lead 入池
- [ ] SEO 基础：meta、sitemap、SSG/ISR
- [ ] 运营后台（内容/站点/线索列表，Payload admin）

验证：任一项目搭出可搜索站点、发文后可收录、表单线索入池成功。

## Phase 2 · 多项目治理
目标：多项目一个后台管，有权限分层。

- [x] 多项目/子域/路径挂站
- [x] 成员 Membership + 角色(owner/admin/editor/viewer)
- [x] 站点模板化与复制
- [x] 线索来源打标 + 去重合并 + 分配
- [x] 渠道统计/归因看板(基础)

验证：后台看全所有项目站点与线索，不丢单不重复；权限正确。

## Phase 3 · 全渠道收口
目标：抖音/小红书线索闭环，客服统一收件。

- [x] Chatwoot 自托管 + API 通道接入
- [x] 网页 live chat -> 线索写回自有 Postgres
- [x] 抖音/小红书手动入池流程 UI
- [x] 线索生命周期 + LeadActivity + 跟进
- [x] 数据看板完善(来源/转化/成交)

验证：网页+抖音+小红书线索一个池子，可按来源归因，客服统一响应。

## 收尾
- [x] 文档对齐（本仓 README/docs 同步）
- [x] 开源化整理：license、贡献说明
- [x] 部署脚本与备份策略

## 变更原则
- 每阶段交付后走 review 门禁再进下一阶段。
- 数据与配置升级优先保护不丢失。
- 不引入外部 CMS；新增依赖前对照架构红线。
