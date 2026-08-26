import type { CollectionConfig } from 'payload'

import { authenticated, membershipManage } from '../access'

/** 项目成员与角色：把用户挂到一个项目，设 owner/admin/editor/viewer。 */
export const Memberships: CollectionConfig = {
  slug: 'memberships',
  labels: {
    singular: { zh: '项目成员', en: 'Membership' },
    plural: { zh: '项目成员', en: 'Memberships' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['project', 'user', 'role', 'updatedAt'],
    description: {
      zh: '多项目治理：把后台成员分配到项目并限定角色。',
      en: 'Multi-project governance: assign admin users to projects with scoped roles.',
    },
  },
  access: {
    read: authenticated,
    create: membershipManage,
    update: membershipManage,
    delete: membershipManage,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.user) data.title = String(data.user)
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: { zh: '标题', en: 'Title' },
      admin: { hidden: true },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      label: { zh: '项目', en: 'Project' },
      admin: {
        description: { zh: '成员所属项目。', en: 'The project this member belongs to.' },
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: { zh: '成员', en: 'User' },
      admin: {
        description: { zh: '后台成员账号。', en: 'The admin user account.' },
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'viewer',
      label: { zh: '角色', en: 'Role' },
      options: [
        { label: { zh: '所有者', en: 'Owner' }, value: 'owner' },
        { label: { zh: '管理者', en: 'Admin' }, value: 'admin' },
        { label: { zh: '编辑', en: 'Editor' }, value: 'editor' },
        { label: { zh: '查看者', en: 'Viewer' }, value: 'viewer' },
      ],
      admin: {
        position: 'sidebar',
        description: {
          zh: 'owner/admin 可管理成员；editor/owner/admin 可写；viewer 仅读。',
          en: 'owner/admin manage members; editor/owner/admin write; viewer read-only.',
        },
      },
    },
  ],
}