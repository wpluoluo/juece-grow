import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 线索：主数据存自有 Postgres。read 仅登录可见（隐私），create 公开（网页表单入池）。 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: { singular: '线索', plural: '线索' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'status', 'source', 'createdAt'],
  },
  access: {
    read: authenticated,
    create: everyone,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'wechat',
      type: 'text',
    },
    {
      name: 'note',
      type: 'textarea',
    },
    {
      name: 'source',
      type: 'text',
      defaultValue: 'website',
    },
    {
      name: 'dedupKey',
      type: 'text',
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: '新线索', value: 'new' },
        { label: '已联系', value: 'contacted' },
        { label: '已完成', value: 'converted' },
        { label: '已关闭', value: 'closed' },
      ],
      defaultValue: 'new',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}