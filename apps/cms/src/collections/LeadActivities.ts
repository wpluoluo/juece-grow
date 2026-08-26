import type { CollectionConfig } from 'payload'

import { isGlobalAdmin, projectScopedRead } from '../access'

/** 线索动态：系统自动记录的事件时间线（创建入池/状态流转/分配/跟进写注），只读审计视图。 */
export const LeadActivities: CollectionConfig = {
  slug: 'lead-activities',
  labels: {
    singular: { zh: '线索动态', en: 'Lead Activity' },
    plural: { zh: '线索动态', en: 'Lead Activities' },
  },
  admin: {
    useAsTitle: 'detail',
    defaultColumns: ['lead', 'type', 'detail', 'actor', 'createdAt'],
    listSearchableFields: ['detail'],
    description: {
      zh: '系统自动记录每条线索的关键事件，只读，用于查看线索生命周期。',
      en: 'System-recorded key events for each lead. Read-only timeline of the lead lifecycle.',
    },
  },
  access: {
    read: projectScopedRead,
    create: isGlobalAdmin,
    update: isGlobalAdmin,
    delete: isGlobalAdmin,
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
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      label: { zh: '事件类型', en: 'Event Type' },
      options: [
        { label: { zh: '创建入池', en: 'Created' }, value: 'created' },
        { label: { zh: '状态流转', en: 'Status Changed' }, value: 'status_changed' },
        { label: { zh: '线索分配', en: 'Assigned' }, value: 'assigned' },
        { label: { zh: '跟进写注', en: 'Follow-up' }, value: 'follow_up' },
        { label: { zh: '系统提醒', en: 'Reminder' }, value: 'reminder' },
      ],
    },
    {
      name: 'detail',
      type: 'textarea',
      label: { zh: '事件描述', en: 'Detail' },
      admin: {
        description: { zh: '该事件的人类可读描述。', en: 'Human-readable description of this event.' },
      },
    },
    {
      name: 'meta',
      type: 'json',
      label: { zh: '结构化数据', en: 'Meta' },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: { zh: '操作人', en: 'Actor' },
      admin: {
        position: 'sidebar',
        description: { zh: '触发该事件的操作人（系统自动写入）。', en: 'Who triggered this event (auto-written).' },
      },
    },
  ],
}