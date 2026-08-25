import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 站点：挂在项目下，独立可访问，SEO 字段独立配置。 */
export const Sites: CollectionConfig = {
  slug: 'sites',
  labels: { singular: '站点', plural: '站点' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'subdomain', 'published'],
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
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
    },
    {
      name: 'subdomain',
      type: 'text',
    },
    {
      name: 'pathSlug',
      type: 'text',
    },
    {
      name: 'metaTitle',
      type: 'text',
    },
    {
      name: 'metaDescription',
      type: 'textarea',
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}