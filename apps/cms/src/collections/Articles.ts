import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 由标题生成 URL 友好的 slug。 */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
}

/** 文章：挂到项目下，正文用 Lexical 富文本，SEO 字段独立配置。 */
export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: {
    singular: { zh: '文章', en: 'Article' },
    plural: { zh: '文章', en: 'Articles' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'coverImage', 'status', 'author', 'publishedAt'],
    description: {
      zh: '产品思路、方案、增长实践等内容，支持富文本与图片。',
      en: 'Product ideas, solutions and growth practices with rich text and images.',
    },
  },
  access: {
    read: everyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeChange: [
      // 未填写 slug 时由标题自动生成；发布文章但没写发布时间时补当前时间。
      ({ data }) => {
        if (data && !data.slug && data.title) data.slug = slugify(data.title)
        if (data && data.status === 'published' && !data.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'coverImage',
      type: 'relationship',
      relationTo: 'media',
      label: { zh: '封面图', en: 'Cover Image' },
      admin: {
        description: {
          zh: '文章封面图，用于列表卡片与分享预览。',
          en: 'Cover image for cards and share previews.',
        },
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: { zh: '标题', en: 'Title' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: { zh: '标识', en: 'Slug' },
      admin: {
        description: {
          zh: 'URL 中的文章唯一标识，留空将由标题自动生成。',
          en: 'Unique URL identifier; blank will be derived from the title.',
        },
      },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      label: { zh: '所属项目', en: 'Project' },
      admin: {
        description: { zh: '文章所属项目/产品。', en: 'The project this article belongs to.' },
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: { zh: '摘要', en: 'Excerpt' },
      admin: {
        description: { zh: '列表卡片与摘要中显示的一句话介绍。', en: 'One-line summary for list cards and excerpts.' },
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: { zh: '分类', en: 'Category' },
      admin: {
        description: { zh: '文章分类（可选）。', en: 'Article category (optional).' },
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: { zh: '标签', en: 'Tags' },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
          label: { zh: '标签', en: 'Tag' },
        },
      ],
      admin: {
        initCollapsed: true,
        description: { zh: '主题标签，便于归类与检索。', en: 'Topic tags for grouping and search.' },
      },
    },
    {
      name: 'author',
      type: 'text',
      label: { zh: '作者', en: 'Author' },
      admin: {
        description: { zh: '作者署名（可选，留空默认显示组织名）。', en: 'Byline; blank defaults to the organization name.' },
      },
    },
    {
      name: 'readingMinutes',
      type: 'number',
      min: 1,
      label: { zh: '阅读时长（分钟）', en: 'Reading Time (min)' },
      admin: {
        description: { zh: '预计阅读时长（分钟），留空自动估算。', en: 'Estimated reading time; blank auto-estimates.' },
      },
    },
    {
      name: 'body',
      type: 'richText',
      label: { zh: '正文', en: 'Body' },
      admin: {
        description: { zh: '正文内容，支持标题、列表、引用、代码、图片等。', en: 'Body content with headings, lists, quotes, code, images, etc.' },
      },
    },
    {
      type: 'collapsible',
      label: { zh: 'SEO', en: 'SEO' },
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'seoTitle',
          type: 'text',
          label: { zh: '页面标题', en: 'SEO Title' },
          admin: {
            description: { zh: '页面标题（≤60 字），留空用文章标题。', en: 'Page title (≤60 chars); blank uses the article title.' },
          },
        },
        {
          name: 'seoDescription',
          type: 'textarea',
          label: { zh: '页面摘要', en: 'SEO Description' },
          admin: {
            description: { zh: '页面摘要（≤120 字），留空用文章摘要。', en: 'Page summary (≤120 chars); blank uses the excerpt.' },
          },
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      label: { zh: '状态', en: 'Status' },
      options: [
        { label: { zh: '草稿', en: 'Draft' }, value: 'draft' },
        { label: { zh: '已发布', en: 'Published' }, value: 'published' },
      ],
      admin: {
        position: 'sidebar',
        description: { zh: '草稿仅后台可见，发布后对公开站点生效。', en: 'Drafts are admin-only; publish to go live.' },
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: { zh: '发布时间', en: 'Publish Date' },
      admin: {
        position: 'sidebar',
        description: { zh: '发布时间，发布时未填会自动补当前时间。', en: 'Publish time; auto-filled on publish if blank.' },
      },
    },
  ],
}