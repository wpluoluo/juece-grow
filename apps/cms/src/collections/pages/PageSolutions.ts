import type { CollectionConfig } from 'payload'

import { ICON_OPTIONS, pageCopyAccess, pageCopyCommonFields, pageCopyIndexes, uniqueProjectPerCopy } from './pageCopyShared'

/**
 * 行业方案页文案（page-solutions）：一比一镜像 `solutions.ts` 的 `SolutionsContent`。
 * 三站该页结构零差异，仅文案与行业条目数不同，因此字段全部同形，不按站裁剪。
 */
export const PageSolutions: CollectionConfig = {
  slug: 'page-solutions',
  labels: {
    singular: { zh: '行业方案页文案', en: 'Solutions Page Copy' },
    plural: { zh: '行业方案页文案', en: 'Solutions Page Copies' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['project', 'status', 'updatedAt'],
    description: {
      zh: '公开站行业方案页文案（手风琴逐行业），一个项目一条记录；改完需重新构建公开站。',
      en: 'Solutions page copy per project (accordion by industry); rebuild the static site after editing.',
    },
  },
  access: pageCopyAccess,
  hooks: { beforeChange: [uniqueProjectPerCopy] },
  indexes: pageCopyIndexes,
  fields: [
    ...pageCopyCommonFields(),
    {
      name: 'meta',
      type: 'group',
      label: { zh: '页面元信息', en: 'Page Meta' },
      fields: [
        { name: 'title', type: 'text', required: true, label: { zh: '文档标题', en: 'Document Title' } },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: { zh: '文档描述', en: 'Document Description' },
        },
      ],
    },
    {
      name: 'hero',
      type: 'group',
      label: { zh: '首屏', en: 'Hero' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        {
          // 原 titleA + titleEm 两段式，按 design D4 折成与首页同形的可重复组。
          name: 'titleLines',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '主标题行', en: 'Title Lines' },
          admin: {
            initCollapsed: true,
            description: {
              zh: '逐行渲染主标题；勾选「强调」即按高亮样式渲染该行（原「主标题 + 强调标题」两段已并入此处）。',
              en: 'One entry per title line; emphasis renders that line highlighted (the old two-field split lives here now).',
            },
          },
          fields: [
            { name: 'text', type: 'text', required: true, label: { zh: '标题文字', en: 'Text' } },
            { name: 'emphasis', type: 'checkbox', label: { zh: '强调', en: 'Emphasis' } },
          ],
        },
        { name: 'description', type: 'textarea', required: true, label: { zh: '副文案', en: 'Description' } },
        {
          name: 'stats',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '首屏数字', en: 'Hero Stats' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'value', type: 'text', required: true, label: { zh: '数值', en: 'Value' } },
            { name: 'label', type: 'text', required: true, label: { zh: '口径', en: 'Label' } },
          ],
        },
      ],
    },
    {
      name: 'industries',
      type: 'array',
      required: true,
      label: { zh: '行业条目', en: 'Industries' },
      admin: {
        initCollapsed: true,
        description: {
          zh: '手风琴每个行业一条，条目本身可增删排序，顺序即页面展示顺序。',
          en: 'One entry per accordion industry; list order is the display order.',
        },
      },
      fields: [
        { name: 'label', type: 'text', required: true, label: { zh: '行业名', en: 'Label' } },
        {
          name: 'meta',
          type: 'text',
          required: true,
          label: { zh: '对应产品', en: 'Meta' },
          admin: {
            description: {
              zh: '行业标题旁的产品名，如「觉策智云」。',
              en: 'Product name shown beside the industry, e.g. Juece SaaS.',
            },
          },
        },
        { name: 'blurb', type: 'textarea', required: true, label: { zh: '一句话概述', en: 'Blurb' } },
        {
          name: 'tone',
          type: 'select',
          required: true,
          options: ICON_OPTIONS,
          label: { zh: '配色产品线', en: 'Tone' },
        },
        { name: 'painPoints', type: 'text', hasMany: true, required: true, label: { zh: '痛点', en: 'Pain Points' } },
        { name: 'solutions', type: 'text', hasMany: true, required: true, label: { zh: '解法', en: 'Solutions' } },
        {
          name: 'scenarios',
          type: 'array',
          required: true,
          label: { zh: '场景卡片', en: 'Scenarios' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'title', type: 'text', required: true, label: { zh: '场景名', en: 'Title' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '场景说明', en: 'Description' } },
          ],
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      label: { zh: '行动召唤', en: 'CTA' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '区块说明', en: 'Description' } },
        { name: 'btnText', type: 'text', required: true, label: { zh: '按钮文字', en: 'Button Text' } },
      ],
    },
  ],
}
