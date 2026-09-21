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
| Page | 站点页面（首页/功能/方案/价格/文章/落地页）；**每页一个结构化 Payload 集合**，字段与该页渲染器的 TS 类型一比一 |
| Block | 页内区块组：**不是**通用 JSON payload 表；只在需要后台增删排序的区块上建可重复区块组（当前为首页 hero 与 CTA），用 Payload 数组的**索引序**表达展示序（后台拖拽即排序，不额外存 sortOrder 列——那与索引表达同一事实，属双写），子字段结构化 |
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
Page         页面（每页一个集合：首页/功能/方案/价格）：project, status + 一比一镜像的各区块结构化字段（页面身份＝集合身份，不设 slug；标题/描述的唯一载体即镜像进来的 meta.{title,description}，不设 seo* 覆写字段，canonical 构建期派生）
Block        页内区块组（嵌在所属页面集合内的 Payload 数组，非独立表）：groupType(hero|cta…) + 该组结构化子字段；展示序＝数组索引序
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
- 页面文案用**结构化字段**（一比一映射渲染器类型，改错字段名编译期即红），不用整页富文本；需要后台增删排序的区块用页内数组承载，展示序即数组索引序。
- 每个项目独立 site/page，SEO 字段可独立配。
- JSON 字段用于富文本与表单定义；**不**用作通用区块 payload（区块内容必须是类型化字段）。

## 5. 预留扩展
- 线索跟进记录(LeadActivity)、渠道统计(Attribution)、多语言(i18n 字段)。
- 后期如需营销自动化，可加 Campaign 模型，接口向后兼容。