import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 项目/产品：一个工作区下管理多个产品。 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: '项目', plural: '项目' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'description',
      type: 'text',
    },
  ],
}