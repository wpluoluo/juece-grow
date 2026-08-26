import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 文章分类：方便按主题筛选与批量管理文章。 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: { zh: '分类', en: 'Category' },
    plural: { zh: '文章分类', en: 'Categories' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'description'],
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
      label: { zh: '分类名称', en: 'Name' },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      label: { zh: '标识', en: 'Slug' },
      admin: {
        description: {
          zh: 'URL 中的分类标识，留空将根据名称生成。',
          en: 'URL identifier; blank will be derived from the name.',
        },
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: { zh: '描述', en: 'Description' },
    },
  ],
}