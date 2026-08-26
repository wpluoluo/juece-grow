import { addDataAndFileToRequest, type CollectionConfig } from 'payload'

import { authenticated, everyone, memberCanWrite } from '../access'

/** 站点：挂在项目下，独立可访问，SEO 字段独立配置。 */
export const Sites: CollectionConfig = {
  slug: 'sites',
  labels: {
    singular: { zh: '站点', en: 'Site' },
    plural: { zh: '站点', en: 'Sites' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'project', 'subdomain', 'status', 'updatedAt'],
    description: {
      zh: '一个项目可以有多个独立站点（官网/主页），SEO 信息各自配置。',
      en: 'A project can have multiple independent sites, each with its own SEO.',
    },
  },
  access: {
    read: everyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  endpoints: [
    {
      path: '/clone',
      method: 'post',
      // 复制一个站点为草稿副本，便于以模板快速起新站。
      handler: async (req) => {
        if (!req.user) {
          return Response.json(
            { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
            { status: 401 },
          )
        }
        if (!(await memberCanWrite(req))) {
          return Response.json(
            { success: false, error: { code: 'FORBIDDEN', message: '无权复制站点' } },
            { status: 403 },
          )
        }

        await addDataAndFileToRequest(req)
        const data = req.data as {
          sourceId?: number
          name?: string
          projectId?: number
        } | null
        if (!data) {
          return Response.json(
            { success: false, error: { code: 'INVALID_JSON', message: '请求体必须是 JSON' } },
            { status: 400 },
          )
        }
        if (!Number.isInteger(data.sourceId) || (data.sourceId as number) <= 0) {
          return Response.json(
            { success: false, error: { code: 'MISSING_SOURCE', message: '缺少有效的 sourceId' } },
            { status: 400 },
          )
        }
        if (data.projectId !== undefined && (!Number.isInteger(data.projectId) || data.projectId <= 0)) {
          return Response.json(
            { success: false, error: { code: 'INVALID_PROJECT', message: 'projectId 必须是正整数' } },
            { status: 400 },
          )
        }

        try {
          const source = await req.payload.findByID({
            collection: 'sites',
            overrideAccess: true,
            id: data.sourceId as number,
            depth: 0,
          })

          const name = (data.name || '').trim() || `${source.name} 副本`
          const clone = await req.payload.create({
            collection: 'sites',
            overrideAccess: true,
            data: {
              name,
              project: data.projectId ?? Number(source.project),
              subdomain: source.subdomain || undefined,
              pathSlug: source.pathSlug || undefined,
              themeColor: source.themeColor || undefined,
              metaTitle: source.metaTitle || undefined,
              metaDescription: source.metaDescription || undefined,
              logo: typeof source.logo === 'number' ? source.logo : undefined,
              ogImage: typeof source.ogImage === 'number' ? source.ogImage : undefined,
              isTemplate: false,
              status: 'draft',
            },
          })

          return Response.json({ success: true, data: { id: clone.id, name: clone.name } })
        } catch {
          return Response.json(
            { success: false, error: { code: 'SITE_CLONE_FAILED', message: '站点复制失败，请稍后再试' } },
            { status: 500 },
          )
        }
      },
    },
  ],
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { zh: '站点名称', en: 'Site Name' },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      label: { zh: '所属项目', en: 'Project' },
      admin: {
        description: { zh: '该站点所属项目。', en: 'The project this site belongs to.' },
      },
    },
    {
      name: 'subdomain',
      type: 'text',
      label: { zh: '子域名', en: 'Subdomain' },
      admin: {
        description: {
          zh: '子域名（如 demo），留空表示跟随项目默认域名。',
          en: 'Subdomain (e.g. demo), blank to use the project default.',
        },
      },
    },
    {
      name: 'pathSlug',
      type: 'text',
      label: { zh: '路径标识', en: 'Path' },
      admin: {
        description: {
          zh: '路径标识（如 /home 或 /product），用于区分站点页面。',
          en: 'Path identifier (e.g. /home) to distinguish site pages.',
        },
      },
    },
    {
      name: 'isTemplate',
      type: 'checkbox',
      label: { zh: '作为模板', en: 'Is Template' },
      admin: {
        position: 'sidebar',
        description: {
          zh: '勾选后可作为模板，通过“复制站点”快速生成新站点。',
          en: 'Mark as a reusable template for cloning new sites.',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      label: { zh: '状态', en: 'Status' },
      options: [
        { label: { zh: '草稿', en: 'Draft' }, value: 'draft' },
        { label: { zh: '已发布', en: 'Published' }, value: 'published' },
        { label: { zh: '已下线', en: 'Archived' }, value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
        description: { zh: '站点上线状态。', en: 'Site publishing status.' },
      },
    },
    {
      type: 'collapsible',
      label: { zh: '品牌与视觉', en: 'Brand & Visuals' },
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'logo',
          type: 'relationship',
          relationTo: 'media',
          label: { zh: 'Logo', en: 'Logo' },
          admin: {
            description: { zh: '站点 Logo（推荐 400×100 透明底 PNG）。', en: 'Site logo (400×100 transparent PNG recommended).' },
          },
        },
        {
          name: 'themeColor',
          type: 'text',
          label: { zh: '主题强调色', en: 'Theme Color' },
          admin: {
            description: { zh: '主题强调色（十六进制，如 #2f8f96）。', en: 'Accent color in hex, e.g. #2f8f96.' },
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: { zh: 'SEO', en: 'SEO' },
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: { zh: '页面标题', en: 'Meta Title' },
          admin: {
            description: { zh: '浏览器标题，建议 ≤ 60 字。', en: 'Browser title, keep under 60 chars.' },
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: { zh: '页面摘要', en: 'Meta Description' },
          admin: {
            description: { zh: '搜索引擎摘要，建议 ≤ 120 字。', en: 'Search snippet, keep under 120 chars.' },
          },
        },
        {
          name: 'ogImage',
          type: 'relationship',
          relationTo: 'media',
          label: { zh: '分享预览图', en: 'OG Image' },
          admin: {
            description: { zh: '分享到社交平台时的预览图（1200×630）。', en: 'Social share preview image (1200×630).' },
          },
        },
      ],
    },
  ],
}