# juece-grow · 数据模型

> 业务字段以 Payload collections 表达（TS，字段 camelCase），数据库层由 Payload 映射为 snake_case。
> 一套 PostgreSQL 库建模站点、内容、线索、项目。

## 1. 命名三层映射
```
前端/接口/业务对象: camelCase
Payload 字段:     camelCase（DB 层由 Payload 映射 snake_case）
PostgreSQL:       snake_case
```

## 2. 顶层模型清单

| 模型 | 说明 |
|---|---|
| Project | 项目/产品，一个工作区多个项目 |
| Site | 站点，挂到项目下，独立可访问 |
| Page | 站点页面（首页/方案/文章/落地页） |
| Block | 页面区块（区块化编辑，非整页富文本） |
| NavItem | 站点导航 |
| Article | 文章 |
| Media | 媒体资源 |
| Lead | 线索 |
| LeadSource | 线索来源（网页表单/抖音/小红书） |
| Form | 留资表单定义 |
| FormSubmission | 表单提交 |
| User | 账号 |
| Membership | 项目成员与角色 |
| InboxChannel | Chatwoot 通道映射 |

## 3. 关键模型字段草案

> 以下为业务字段语义（camelCase）。最终实体由 Payload collections 定义并自管建表，不再手写 schema 文件；字段名即业务名，DB 层由 Payload 映射 snake_case。

```txt
Project      项目/产品：name, slug, description
Site         站点：projectId, name, subdomain, pathSlug, metaTitle, metaDescription, published
Page         页面：siteId, slug, title, seoTitle, seoDescription, status
Block        区块：pageId, type, sortOrder, payload, siteId(全站区块)
Article      文章：projectId, title, slug, excerpt, body(Lexical JSON), coverId, status, seoTitle, seoDescription, publishedAt
Lead         线索：projectId, sourceId, name, phone, wechat, note, status, assigneeId, dedupKey
LeadSource   来源：name(website/douyin/xiaohongshu/manual), slug
Form         表单：siteId, name, fields(JSON)
FormSubmission 提交：formId, data(JSON), leadId
User / Membership  账号与项目角色
Media        媒体
```

## 4. 设计原则
- 线索去重指纹(dedupKey)：优先手机号，其次微信，统一做去重合并。
- 内容区块化(Block)优先于整页富文本，便于改文案和复用。
- 每个项目独立 site/page，SEO 字段可独立配。
- JSON 字段用于富文本、表单定义、区块 payload，避免大量冗余列。

## 5. 预留扩展
- 线索跟进记录(LeadActivity)、渠道统计(Attribution)、多语言(i18n 字段)。
- 后期如需营销自动化，可加 Campaign 模型，接口向后兼容。