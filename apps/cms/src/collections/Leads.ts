import { addDataAndFileToRequest, type CollectionConfig } from 'payload'

import {
  isGlobalAdmin,
  isProjectMember,
  leadScopedWrite,
  memberCanWriteProject,
  projectScopedRead,
} from '../access'
import { LEAD_SOURCES } from '../lib/leadSources'

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
    read: projectScopedRead,
    create: leadScopedWrite,
    update: leadScopedWrite,
    delete: leadScopedWrite,
  },
  hooks: {
    beforeDelete: [
      // 级联清理线索关联数据，避免 Postgres 外键约束导致删除报错。
      async ({ id, req }) => {
        const { payload } = req
        const leadId = String(id)
        await Promise.all([
          payload.delete({
            collection: 'lead-activities',
            overrideAccess: true,
            where: { lead: { equals: leadId } },
          }),
          payload.delete({
            collection: 'reminder-notices',
            overrideAccess: true,
            where: { lead: { equals: leadId } },
          }),
        ])
      },
    ],
    beforeChange: [
      // 列表标题：公司名 > 称呼 > 手机号 > 微信号，保证后台不出现空白行。
      ({ data }) => {
        if (data) {
          data.title = data.company || data.name || data.phone || data.wechat || '未命名线索'
        }
        return data
      },
    ],
    afterChange: [
      // 线索动态：在唯一写入路径记录关键事件（创建/状态流转/分配/跟进写注），见 lib/leadActivity。
      async ({ doc, previousDoc, operation, req }) => {
        const { payload, user, transactionID } = req
        const lead = doc as { id: number; project?: { id: number } | number; status?: string; owner?: unknown; followUpNote?: string }
        // afterChange 返回的 doc 中 relationship 可能已被填充为对象，取它的 id。
        const projectRaw = lead.project
        const projectId = Number(typeof projectRaw === 'object' && projectRaw !== null ? (projectRaw as { id: number }).id : projectRaw)
        if (!projectId) return

        const prev =
          operation === 'update' && previousDoc
            ? (previousDoc as { status?: string; owner?: unknown; followUpNote?: string })
            : null

        let type: 'created' | 'status_changed' | 'assigned' | 'follow_up' | null = null
        let detail = ''
        const meta: Record<string, unknown> = { projectId }

        if (operation === 'create') {
          type = 'created'
          detail = '线索入池'
        } else if (prev) {
          if (prev.status !== lead.status) {
            type = 'status_changed'
            meta.from = prev.status ?? ''
            meta.to = lead.status ?? ''
            detail = `状态流转：${meta.from} → ${meta.to}`
          } else if (prev.owner !== lead.owner) {
            type = 'assigned'
            // lead.owner 在 afterChange 中可能为填充对象，只记录其 id。
            const ownerRaw = lead.owner as { id: number } | number | null | undefined
            meta.owner =
              ownerRaw == null
                ? null
                : Number(typeof ownerRaw === 'object' ? (ownerRaw as { id: number }).id : ownerRaw)
            detail = '已分配跟进人'
          } else if (prev.followUpNote !== lead.followUpNote) {
            type = 'follow_up'
            detail = '更新跟进记录'
          }
        }

        if (!type) return

        const actorId = user ? Number(user.id) : null
        try {
          await payload.create({
            collection: 'lead-activities',
            overrideAccess: true,
            req: { transactionID },
            data: {
              lead: lead.id,
              project: projectId,
              type,
              detail,
              meta,
              actor: actorId === null ? null : actorId,
            },
          })
        } catch (e) {
          // 动态记录失败不影响线索主流程，仅记录到服务端日志便于排查。
          console.error('[lead-activity] 记录失败', lead.id, type, e)
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/assign',
      method: 'post',
      // 分配线索给项目成员：发起人需对该项目有写权限，被分配人需是该项目成员或全局管理员。
      handler: async (req) => {
        if (!req.user) {
          return Response.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
            { status: 401 },
          )
        }

        await addDataAndFileToRequest(req)
        const data = req.data as { leadId?: number; assigneeId?: number } | null
        if (!data) {
          return Response.json(
            { success: false, error: { code: 'INVALID_JSON', message: '请求体必须是 JSON' } },
            { status: 400 },
          )
        }
        if (!Number.isInteger(data.leadId) || (data.leadId as number) <= 0) {
          return Response.json(
            { success: false, error: { code: 'MISSING_LEAD', message: '缺少有效的 leadId' } },
            { status: 400 },
          )
        }
        if (!Number.isInteger(data.assigneeId) || (data.assigneeId as number) <= 0) {
          return Response.json(
            { success: false, error: { code: 'INVALID_ASSIGNEE', message: 'assigneeId 必须是正整数' } },
            { status: 400 },
          )
        }

        try {
          const lead = await req.payload.findByID({
            collection: 'leads',
            overrideAccess: true,
            id: data.leadId as number,
            depth: 0,
          })
          if (!lead) {
            return Response.json(
              { success: false, error: { code: 'LEAD_NOT_FOUND', message: '线索不存在' } },
              { status: 404 },
            )
          }

          const projectId = Number(lead.project)
          if (!(await memberCanWriteProject(req, projectId)) || !(await isProjectMember(req, projectId))) {
            return Response.json(
              { success: false, error: { code: 'FORBIDDEN', message: '无权操作该线索' } },
              { status: 403 },
            )
          }

          const assignee = await req.payload.findByID({
            collection: 'users',
            overrideAccess: true,
            id: data.assigneeId as number,
            depth: 0,
          })
          if (!assignee) {
            return Response.json(
              { success: false, error: { code: 'ASSIGNEE_NOT_FOUND', message: '跟进人不存在' } },
              { status: 404 },
            )
          }

          if (!isGlobalAdmin(assignee)) {
            const membership = await req.payload.find({
              collection: 'memberships',
              overrideAccess: true,
              where: {
                and: [
                  { project: { equals: projectId } },
                  { user: { equals: data.assigneeId as number } },
                ],
              },
              limit: 1,
              depth: 0,
            })
            if (membership.docs.length === 0) {
              return Response.json(
                { success: false, error: { code: 'ASSIGNEE_NOT_IN_PROJECT', message: '跟进人不是该项目成员' } },
                { status: 400 },
              )
            }
          }

          const updated = await req.payload.update({
            collection: 'leads',
            overrideAccess: true,
            id: lead.id,
            data: { owner: data.assigneeId as number },
          })

          return Response.json({ success: true, data: { id: updated.id, owner: updated.owner } })
        } catch {
          return Response.json(
            { success: false, error: { code: 'LEAD_ASSIGN_FAILED', message: '分配失败，请稍后再试' } },
            { status: 500 },
          )
        }
      },
    },
  ],
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
      type: 'select',
      options: LEAD_SOURCES,
      defaultValue: 'website',
      label: { zh: '来源', en: 'Source' },
      admin: {
        description: { zh: '线索来源渠道（打标用）。', en: 'Lead source channel (for tagging).' },
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
      name: 'dealAmount',
      type: 'number',
      min: 0,
      label: { zh: '成交金额（元）', en: 'Deal Amount (CNY)' },
      admin: {
        position: 'sidebar',
        description: {
          zh: '成交金额，标记为“已成交”时填写（单位：元，可选）。',
          en: 'Deal amount recorded when converted (CNY, optional).',
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