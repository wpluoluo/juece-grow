import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 留资表单定义：挂到站点下，字段结构存 JSON。 */
export const Forms: CollectionConfig = {
  slug: 'forms',
  labels: { singular: '表单', plural: '表单' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
  },
  access: {
    read: everyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
    },
    {
      name: 'fields',
      type: 'json',
    },
  ],
}