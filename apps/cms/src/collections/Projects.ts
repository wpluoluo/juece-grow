import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 项目/产品：一个工作区下管理多个产品。 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: { zh: '项目', en: 'Project' },
    plural: { zh: '项目', en: 'Projects' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'contactName', 'createdAt'],
    description: {
      zh: '你的每个产品/领域即是一个项目，线索都挂到项目下归类归集。',
      en: 'Each product or focus area is a project; leads are grouped by project.',
    },
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
      label: { zh: '项目名称', en: 'Project Name' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: { zh: '标识', en: 'Slug' },
      admin: {
        description: {
          zh: 'URL 中使用的英文短标识（唯一）。',
          en: 'Unique URL-friendly English identifier.',
        },
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: { zh: '简介', en: 'Description' },
      admin: {
        description: {
          zh: '一句话说明这个项目/产品是做什么的。',
          en: 'One sentence on what this project does.',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      label: { zh: '状态', en: 'Status' },
      options: [
        { label: { zh: '运营中', en: 'Active' }, value: 'active' },
        { label: { zh: '灰度中', en: 'Beta' }, value: 'beta' },
        { label: { zh: '已下线', en: 'Archived' }, value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
        description: { zh: '当前运营状态。', en: 'Current operating status.' },
      },
    },
    {
      type: 'collapsible',
      label: { zh: '项目联系人', en: 'Project Contact' },
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'contactName',
          type: 'text',
          label: { zh: '联系人', en: 'Contact Name' },
        },
        {
          name: 'contactEmail',
          type: 'email',
          label: { zh: '联系邮箱', en: 'Contact Email' },
        },
        {
          name: 'contactPhone',
          type: 'text',
          label: { zh: '联系电话', en: 'Contact Phone' },
        },
        {
          name: 'url',
          type: 'text',
          label: { zh: '主页地址', en: 'Website' },
          admin: {
            description: { zh: '项目对外主页地址（可选）。', en: 'Public homepage URL (optional).' },
          },
        },
      ],
    },
  ],
}