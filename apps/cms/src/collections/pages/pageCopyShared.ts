import type { CollectionBeforeChangeHook, CompoundIndex, Field, OptionObject } from 'payload'

import { authenticated } from '../../access'

/**
 * 产品线标识：与 Astro 侧 `IconKey = 'saas' | 'erp' | 'yunque'` 联合类型一一对应（design D3）。
 * 三站 12 份快照里 `tone` / `icon` 实际出现的全部取值即这三项，不增不减。
 */
export const ICON_OPTIONS: OptionObject[] = [
  { label: { zh: '觉策智云（开店 / 卖货）', en: 'Juece SaaS' }, value: 'saas' },
  { label: { zh: '觉策 ERP（制作交付）', en: 'Juece ERP' }, value: 'erp' },
  { label: { zh: '云雀 Yunque（智能体）', en: 'Yunque' }, value: 'yunque' },
]

/** 按钮行为：`lead` 走留资表单，`href` 跳转链接。与 `action: 'lead' | 'href'` 一致。 */
export const ACTION_OPTIONS: OptionObject[] = [
  { label: { zh: '留资表单', en: 'Lead form' }, value: 'lead' },
  { label: { zh: '跳转链接', en: 'Link' }, value: 'href' },
]

/** 页面文案集合的读取权限：匿名不可枚举，公开读取由 /api/v2/content/pages 负责（与 Sites/Articles 同处置）。 */
export const pageCopyAccess = {
  read: authenticated,
  create: authenticated,
  update: authenticated,
  delete: authenticated,
}

/**
 * 「一个项目在本集合里只能有一条记录」的执行者 = 数据库唯一索引（四个集合共用同一份定义）。
 * `beforeChange` 钩子是 find-then-write，并发 create 能绕过它；没有索引时约束只存在于应用层。
 * 集合无软删列，故直接对 `project` 建唯一索引即为正确语义，不加 WHERE 条件。
 */
export const pageCopyIndexes: CompoundIndex[] = [{ unique: true, fields: ['project'] }]

/**
 * 四个页面集合共用的通用字段：站归属 + 发布状态。
 * 站归属复用 `project` relationship（不新增站枚举，design D1）；状态沿用仓内 `select` 约定（无 versions/drafts）。
 * 页面标题/描述的唯一载体是各集合一比一镜像出来的 `meta.{title,description}`（design D8），这里不再设 seo* 字段。
 */
export function pageCopyCommonFields(): Field[] {
  return [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      label: { zh: '所属项目', en: 'Project' },
      admin: {
        position: 'sidebar',
        description: {
          zh: '该页文案所属项目（一个项目在本集合里只能有一条记录）。',
          en: 'The project this page copy belongs to; one record per project per page collection.',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      label: { zh: '状态', en: 'Status' },
      options: [
        { label: { zh: '草稿', en: 'Draft' }, value: 'draft' },
        { label: { zh: '已发布', en: 'Published' }, value: 'published' },
      ],
      admin: {
        position: 'sidebar',
        description: {
          zh: '草稿仅后台可见，公开站构建只取已发布记录。',
          en: 'Drafts stay in admin; the static build reads published only.',
        },
      },
    },
  ]
}

/**
 * 页面身份 = 集合身份（design D1）：同一页面集合内，一个项目只能有一条文案记录。
 * TS 侧没有 id/slug 字段，这里不为造标识而加字段，只挡重复占用。
 */
export const uniqueProjectPerCopy: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
  collection,
}) => {
  const raw = data.project ?? originalDoc?.project
  const projectId = Number(typeof raw === 'object' && raw !== null ? (raw as { id?: number | string }).id : raw)
  const selfId = operation === 'update' ? originalDoc?.id : undefined
  const found = await req.payload.find({
    collection: collection.slug,
    where: { project: { equals: projectId } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (found.docs.some((doc) => doc.id !== selfId)) {
    throw new Error('该项目在本页面已有一条文案记录，请直接编辑现有记录（一个项目对应一条）。')
  }
  return data
}
