import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

/** 留资表单定义：挂到站点下，字段结构存 JSON。 */
export const Forms: CollectionConfig = {
  slug: 'forms',
  labels: {
    singular: { zh: '表单', en: 'Form' },
    plural: { zh: '表单', en: 'Forms' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'site', 'status', 'updatedAt'],
    description: {
      zh: '定义公开页面上的留资表单字段与提交去向。',
      en: 'Define lead-capture form fields and submission target on public pages.',
    },
  },
  access: {
    // 表单定义属后台配置，匿名无需读取；杜绝字段结构枚举（C4）。
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { zh: '表单名称', en: 'Form Name' },
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      label: { zh: '所属站点', en: 'Site' },
      admin: {
        description: { zh: '所属站点（选填，可全局复用）。', en: 'Owning site (optional, reusable globally).' },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      label: { zh: '状态', en: 'Status' },
      options: [
        { label: { zh: '草稿', en: 'Draft' }, value: 'draft' },
        { label: { zh: '启用', en: 'Active' }, value: 'active' },
      ],
      admin: {
        position: 'sidebar',
        description: { zh: '启用后才会被公开页面使用。', en: 'Only active forms are used on public pages.' },
      },
    },
    {
      name: 'fields',
      type: 'json',
      label: { zh: '字段结构', en: 'Fields' },
      admin: {
        description: { zh: '字段结构（JSON），如字段名、是否必填、顺序等。', en: 'Field structure (JSON): names, required flags, order, etc.' },
      },
    },
  ],
}