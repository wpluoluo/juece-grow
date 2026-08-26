import type { CollectionConfig } from 'payload'

import { authenticated, isGlobalAdmin, projectScopedRead, projectWrite } from '../access'

/**
 * 提醒规则：可配置的跟进提醒（due 到期 / sla 首次跟进超时）。
 * project 留空表示全局规则，作用于所有项目。由 reminderCron 定时消费。
 */
export const ReminderRules: CollectionConfig = {
  slug: 'reminder-rules',
  labels: {
    singular: { zh: '提醒规则', en: 'Reminder Rule' },
    plural: { zh: '提醒规则', en: 'Reminder Rules' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'project', 'enabled', 'updatedAt'],
    listSearchableFields: ['name'],
    description: {
      zh: '配置跟进提醒的触发规则（到期 / 首次跟进 SLA），由后台定时扫描消费。',
      en: 'Configure follow-up reminder rules (due / first-response SLA), consumed by the scheduled scan.',
    },
  },
  access: {
    read: projectScopedRead,
    create: projectWrite,
    update: projectWrite,
    delete: ({ req }) => isGlobalAdmin(req.user),
  },
  hooks: {
    beforeChange: [
      // 未绑定项目的全局规则覆盖所有项目，仅管理员可建/改；项目级规则由项目写权限者管理。
      ({ data, operation, originalDoc, req }) => {
        if (!data) return data
        const effectiveProject = data.project ?? (operation === 'update' ? originalDoc?.project : undefined)
        const isGlobal = effectiveProject == null || Number(effectiveProject) === 0
        if (isGlobal && !isGlobalAdmin(req.user)) {
          throw new Error('仅管理员可配置全局提醒规则')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { zh: '规则名称', en: 'Rule Name' },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      label: { zh: '适用项目', en: 'Project' },
      admin: {
        description: { zh: '留空表示全局规则，作用于所有项目。', en: 'Empty means a global rule for all projects.' },
      },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'due',
      label: { zh: '提醒类型', en: 'Kind' },
      options: [
        { label: { zh: '到期提醒', en: 'Due' }, value: 'due' },
        { label: { zh: '首次跟进 SLA', en: 'First-response SLA' }, value: 'sla' },
      ],
    },
    {
      name: 'applyStatuses',
      type: 'select',
      required: true,
      hasMany: true,
      defaultValue: ['new'],
      label: { zh: '适用阶段', en: 'Apply to Statuses' },
      options: [
        { label: { zh: '新线索', en: 'New' }, value: 'new' },
        { label: { zh: '跟进中', en: 'Contacted' }, value: 'contacted' },
        { label: { zh: '已成交', en: 'Converted' }, value: 'converted' },
        { label: { zh: '已关闭', en: 'Closed' }, value: 'closed' },
      ],
    },
    {
      name: 'graceHours',
      type: 'number',
      min: 1,
      label: { zh: 'SLA 阈值（小时）', en: 'SLA Threshold (hours)' },
      admin: {
        condition: (_, siblingData) => siblingData?.kind === 'sla',
        description: { zh: '仅首次跟进 SLA 使用：新线索创建超过该小时数未首响。', en: 'Only for SLA: exceeds this many hours since creation without first response.' },
      },
    },
    {
      name: 'target',
      type: 'relationship',
      relationTo: 'users',
      label: { zh: '提醒对象', en: 'Receiver' },
      admin: {
        position: 'sidebar',
        description: { zh: '留空则提醒给线索的跟进人（owner）。', en: 'Empty means remind the lead owner.' },
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: { zh: '启用', en: 'Enabled' },
      admin: {
        position: 'sidebar',
      },
    },
  ],
}