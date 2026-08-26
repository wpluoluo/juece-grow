import type { CollectionConfig } from 'payload'

import { isGlobalAdmin, projectScopedRead, projectWrite } from '../access'

/**
 * 提醒记录：规则命中后落一条，兼作「待跟进」清单与判重依据。
 * 同一 lead + rule + kind 存在 status=open 时不再重复提醒。
 */
export const ReminderNotices: CollectionConfig = {
  slug: 'reminder-notices',
  labels: {
    singular: { zh: '待跟进提醒', en: 'Reminder Notice' },
    plural: { zh: '待跟进提醒', en: 'Reminder Notices' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['lead', 'rule', 'kind', 'receiver', 'status', 'dueAt'],
    description: {
      zh: '由提醒规则触发的待跟进记录，处理后可标记为已办。',
      en: 'Follow-up records triggered by reminder rules; mark as done when handled.',
    },
  },
  access: {
    read: projectScopedRead,
    create: ({ req }) => isGlobalAdmin(req.user),
    // 标记「已办」是跟进处理动作，项目写权限者应可操作，与读取的项目隔离对齐。
    update: projectWrite,
    delete: ({ req }) => isGlobalAdmin(req.user),
  },
  fields: [
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'leads',
      required: true,
      index: true,
      label: { zh: '线索', en: 'Lead' },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      index: true,
      label: { zh: '所属项目', en: 'Project' },
    },
    {
      name: 'rule',
      type: 'relationship',
      relationTo: 'reminder-rules',
      required: true,
      index: true,
      label: { zh: '命中规则', en: 'Rule' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: { zh: '到期提醒', en: 'Due' }, value: 'due' },
        { label: { zh: '首次跟进 SLA', en: 'First-response SLA' }, value: 'sla' },
      ],
      label: { zh: '提醒类型', en: 'Kind' },
    },
    {
      name: 'receiver',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: { zh: '提醒对象', en: 'Receiver' },
      admin: {
        description: { zh: '提醒给谁（规则 target 或线索跟进人）。', en: 'Rule target or the lead owner.' },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: { zh: '待处理', en: 'Open' }, value: 'open' },
        { label: { zh: '已处理', en: 'Done' }, value: 'done' },
      ],
      label: { zh: '状态', en: 'Status' },
    },
    {
      name: 'dueAt',
      type: 'date',
      label: { zh: '提醒时间', en: 'Due At' },
      admin: {
        description: { zh: '命中时的应处理时间。', en: 'When the reminder was due.' },
      },
    },
  ],
}