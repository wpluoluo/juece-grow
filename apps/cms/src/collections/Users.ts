import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

/** 用户：仅后台人员。role 决定可操作的集合。 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    loginWithUsername: true,
  },
  labels: {
    singular: { zh: '用户', en: 'User' },
    plural: { zh: '用户', en: 'Users' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['username', 'name', 'role', 'email'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'username',
      type: 'text',
      required: true,
      unique: true,
      label: { zh: '用户名', en: 'Username' },
      admin: {
        description: {
          zh: '登录用户名（唯一），用于后台登录。',
          en: 'Unique login username for the admin.',
        },
      },
    },
    {
      name: 'name',
      type: 'text',
      label: { zh: '显示姓名', en: 'Display Name' },
      admin: {
        description: {
          zh: '用于线索负责人等处展示。',
          en: 'Shown as the lead owner, etc.',
        },
      },
    },
    {
      name: 'email',
      type: 'email',
      label: { zh: '工作邮箱', en: 'Email' },
      admin: {
        description: {
          zh: '用于接收系统通知（可选）。',
          en: 'For system notifications (optional).',
        },
      },
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'operator',
      label: { zh: '角色', en: 'Role' },
      options: [
        { label: { zh: '运营', en: 'Operator' }, value: 'operator' },
        { label: { zh: '内容编辑', en: 'Editor' }, value: 'editor' },
        { label: { zh: '管理员', en: 'Admin' }, value: 'admin' },
      ],
      admin: {
        position: 'sidebar',
        description: {
          zh: '决定可访问的后台集合。',
          en: 'Determines accessible collections.',
        },
      },
    },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media',
      label: { zh: '头像', en: 'Avatar' },
      admin: {
        description: { zh: '头像图片（可选）。', en: 'Profile image (optional).' },
      },
    },
  ],
}