import type { CollectionConfig, Where } from 'payload'

import { membershipScopedManage, projectScopedRead } from '../access'

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
    read: projectScopedRead,
    create: membershipScopedManage,
    update: membershipScopedManage,
    delete: membershipScopedManage,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.user) data.title = String(data.user)
        return data
      },
    ],
    beforeDelete: [
      // 成员被移除后，清空其在该项目名下的负责人/提醒接收人，避免 owner 指向非成员（孤儿）。
      async ({ id, req }) => {
        const { payload } = req
        const dep = await payload.findByID({ collection: 'memberships', overrideAccess: true, id, depth: 0 })
        const projectId = Number(dep?.project)
        const userId = String(dep?.user ?? '')
        if (!projectId || !userId) return
        const where: Where = { and: [{ project: { equals: projectId } }, { owner: { equals: userId } }] }
        await payload.update({
          collection: 'leads',
          overrideAccess: true,
          where,
          data: { owner: null },
        })
        await payload.delete({
          collection: 'reminder-notices',
          overrideAccess: true,
          where: {
            and: [
              { project: { equals: projectId } },
              { receiver: { equals: userId } },
              { status: { equals: 'open' } },
            ],
          },
        })
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