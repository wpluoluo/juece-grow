import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 线索：主数据存自有 Postgres。read 仅登录可见（隐私），create 公开（网页表单入池）。 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: { zh: '线索', en: 'Lead' },
    plural: { zh: '线索', en: 'Leads' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'project', 'status', 'source', 'owner', 'createdAt'],
    listSearchableFields: ['name', 'phone', 'wechat', 'company'],
    description: {
      zh: '从公开表单到站内录入的客户线索，逐个跟进并记录过程。',
      en: 'Customer leads from public forms and manual entry, tracked step by step.',
    },
  },
  access: {
    read: authenticated,
    create: everyone,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeChange: [
      // 列表标题：公司名 > 称呼 > 手机号 > 微信号，保证后台不出现空白行。
      ({ data }) => {
        if (data) {
          data.title = data.company || data.name || data.phone || data.wechat || '未命名线索'
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: { zh: '标题', en: 'Title' },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      label: { zh: '所属项目', en: 'Project' },
      admin: {
        description: { zh: '线索所属项目。', en: 'The project this lead belongs to.' },
      },
    },
    {
      name: 'name',
      type: 'text',
      label: { zh: '称呼/姓名', en: 'Name' },
      admin: {
        description: { zh: '称呼/姓名。', en: 'Contact name.' },
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: { zh: '手机号', en: 'Phone' },
      admin: {
        description: { zh: '手机号（与微信号至少留一个）。', en: 'Phone number (share with wechat at least one).' },
      },
    },
    {
      name: 'wechat',
      type: 'text',
      label: { zh: '微信号', en: 'WeChat' },
      admin: {
        description: { zh: '微信号（与手机号至少留一个）。', en: 'WeChat ID (share with phone at least one).' },
      },
    },
    {
      name: 'company',
      type: 'text',
      label: { zh: '公司/门店', en: 'Company' },
      admin: {
        description: { zh: '所在公司/门店名称（可选）。', en: 'Company or store name (optional).' },
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: { zh: '需求描述', en: 'Note' },
      admin: {
        description: { zh: '客户自述的需求或当前情况。', en: 'Customer-stated need or current situation.' },
      },
    },
    {
      name: 'source',
      type: 'text',
      defaultValue: 'website',
      label: { zh: '来源', en: 'Source' },
      admin: {
        description: { zh: '来源渠道，如 website / 活动 / 手动录入等。', en: 'Source channel, e.g. website / event / manual.' },
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      label: { zh: '跟进人', en: 'Owner' },
      admin: {
        position: 'sidebar',
        description: { zh: '当前跟进人。', en: 'Current owner.' },
      },
    },
    {
      name: 'status',
      type: 'select',
      label: { zh: '阶段', en: 'Status' },
      options: [
        { label: { zh: '新线索', en: 'New' }, value: 'new' },
        { label: { zh: '跟进中', en: 'Contacted' }, value: 'contacted' },
        { label: { zh: '已成交', en: 'Converted' }, value: 'converted' },
        { label: { zh: '已关闭', en: 'Closed' }, value: 'closed' },
      ],
      defaultValue: 'new',
      admin: {
        position: 'sidebar',
        description: { zh: '当前跟进阶段。', en: 'Current follow-up stage.' },
        components: {
          Cell: {
            path: './components/StatusCell.tsx',
            exportName: 'StatusCell',
          },
        },
      },
    },
    {
      name: 'dedupKey',
      type: 'text',
      index: true,
      label: { zh: '去重依据', en: 'Dedupe Key' },
      admin: {
        position: 'sidebar',
        description: { zh: '去重依据（手机号或微信号），系统自动写入。', en: 'Dedupe key (phone or wechat), auto-written.' },
      },
    },
    {
      name: 'followUpNote',
      type: 'textarea',
      label: { zh: '最近跟进记录', en: 'Follow-up Note' },
      admin: {
        description: { zh: '最近一次跟进记录。', en: 'Most recent follow-up note.' },
      },
    },
    {
      name: 'nextFollowUpAt',
      type: 'date',
      label: { zh: '下次跟进时间', en: 'Next Follow-up' },
      admin: {
        position: 'sidebar',
        description: { zh: '下次跟进提醒时间。', en: 'Reminder for the next follow-up.' },
      },
    },
    {
      name: 'activity',
      type: 'array',
      label: { zh: '跟进历史', en: 'Activity' },
      admin: {
        initCollapsed: true,
        description: { zh: '跟进历史时间线。', en: 'Follow-up history timeline.' },
      },
      fields: [
        {
          name: 'time',
          type: 'date',
          required: true,
          label: { zh: '时间', en: 'Time' },
        },
        {
          name: 'type',
          type: 'select',
          label: { zh: '方式', en: 'Type' },
          options: [
            { label: { zh: '电话', en: 'Call' }, value: 'call' },
            { label: { zh: '微信', en: 'WeChat' }, value: 'wechat' },
            { label: { zh: '到店', en: 'Visit' }, value: 'visit' },
            { label: { zh: '报价', en: 'Quote' }, value: 'quote' },
          ],
        },
        {
          name: 'summary',
          type: 'textarea',
          label: { zh: '记录', en: 'Summary' },
        },
      ],
    },
  ],
}