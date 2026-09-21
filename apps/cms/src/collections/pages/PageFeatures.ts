import type { Block, CollectionConfig } from 'payload'

import { pageCopyAccess, pageCopyCommonFields, pageCopyIndexes, uniqueProjectPerCopy } from './pageCopyShared'

/** 面板里的色块宽度写成「数字+百分号」（如 72%），它是 CSS 几何值不是数量，故存文本并校验格式。 */
const CSS_PERCENT = /^\d+(\.\d+)?%$/

function validateCssPercent(value: unknown): true | string {
  if (value == null || value === '') return true
  return CSS_PERCENT.test(String(value)) ? true : '宽度需为百分比形式，例如 72%'
}

/** 数据面板五形态：`kind` 的五个取值即 block slug（blockType 承载判别，不另存 kind，避免双写）。 */
const featurePanelBlocks: Block[] = [
  {
    slug: 'blocks',
    labels: {
      singular: { zh: '组成色块', en: 'Composition Blocks' },
      plural: { zh: '组成色块', en: 'Composition Blocks' },
    },
    fields: [
      { name: 'badge', type: 'text', required: true, label: { zh: '角标', en: 'Badge' } },
      { name: 'title', type: 'text', required: true, label: { zh: '面板标题', en: 'Panel Title' } },
      {
        name: 'blocks',
        type: 'array',
        required: true,
        label: { zh: '色块', en: 'Blocks' },
        admin: { initCollapsed: true },
        fields: [
          { name: 'no', type: 'text', required: true, label: { zh: '编号', en: 'No.' } },
          { name: 'name', type: 'text', required: true, label: { zh: '名称', en: 'Name' } },
          { name: 'note', type: 'text', required: true, label: { zh: '说明', en: 'Note' } },
          {
            name: 'w',
            type: 'text',
            required: true,
            validate: validateCssPercent,
            label: { zh: '宽度（百分比）', en: 'Width (percent)' },
            admin: {
              description: {
                zh: 'CSS 宽度值，形如 72%；它是版式几何参数，不是数量。',
                en: 'A CSS width like 72%; a layout geometry value, not a quantity.',
              },
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'chips',
    labels: {
      singular: { zh: '标签与占比行', en: 'Chips & Rows' },
      plural: { zh: '标签与占比行', en: 'Chips & Rows' },
    },
    fields: [
      { name: 'badge', type: 'text', required: true, label: { zh: '角标', en: 'Badge' } },
      { name: 'title', type: 'text', required: true, label: { zh: '面板标题', en: 'Panel Title' } },
      { name: 'chips', type: 'text', hasMany: true, required: true, label: { zh: '标签', en: 'Chips' } },
      {
        name: 'rows',
        type: 'array',
        required: true,
        label: { zh: '占比行', en: 'Rows' },
        admin: { initCollapsed: true },
        fields: [
          { name: 'label', type: 'text', required: true, label: { zh: '条目名', en: 'Label' } },
          {
            name: 'w',
            type: 'number',
            required: true,
            label: { zh: '占比数值', en: 'Width' },
            admin: {
              description: {
                zh: '进度条宽度的数值（渲染侧按 0–100 处理），与色块面板的百分比文本不同。',
                en: 'Numeric bar width (treated as 0-100 by the renderer), unlike the percent text in blocks.',
              },
            },
          },
          { name: 'val', type: 'text', required: true, label: { zh: '数值文案', en: 'Value' } },
        ],
      },
    ],
  },
  {
    slug: 'bars',
    labels: {
      singular: { zh: '柱状趋势', en: 'Bar Trend' },
      plural: { zh: '柱状趋势', en: 'Bar Trend' },
    },
    fields: [
      { name: 'badge', type: 'text', required: true, label: { zh: '角标', en: 'Badge' } },
      { name: 'title', type: 'text', required: true, label: { zh: '面板标题', en: 'Panel Title' } },
      {
        name: 'kpis',
        type: 'array',
        required: true,
        label: { zh: '关键指标', en: 'KPIs' },
        admin: { initCollapsed: true },
        fields: [
          { name: 'val', type: 'text', required: true, label: { zh: '数值文案', en: 'Value' } },
          { name: 'label', type: 'text', required: true, label: { zh: '口径', en: 'Label' } },
        ],
      },
      { name: 'bars', type: 'number', hasMany: true, required: true, label: { zh: '柱高数值', en: 'Bars' } },
      { name: 'months', type: 'text', hasMany: true, required: true, label: { zh: '横轴标签', en: 'Months' } },
    ],
  },
  {
    slug: 'journey',
    labels: {
      singular: { zh: '流程步骤', en: 'Journey Steps' },
      plural: { zh: '流程步骤', en: 'Journey Steps' },
    },
    fields: [
      { name: 'badge', type: 'text', required: true, label: { zh: '角标', en: 'Badge' } },
      { name: 'title', type: 'text', required: true, label: { zh: '面板标题', en: 'Panel Title' } },
      { name: 'steps', type: 'text', hasMany: true, required: true, label: { zh: '步骤', en: 'Steps' } },
    ],
  },
  {
    slug: 'agent',
    labels: {
      singular: { zh: '智能体组成', en: 'Agent Composition' },
      plural: { zh: '智能体组成', en: 'Agent Composition' },
    },
    fields: [
      { name: 'badge', type: 'text', required: true, label: { zh: '角标', en: 'Badge' } },
      { name: 'title', type: 'text', required: true, label: { zh: '面板标题', en: 'Panel Title' } },
      { name: 'core', type: 'text', required: true, label: { zh: '核心名称', en: 'Core' } },
      {
        name: 'pegs',
        type: 'array',
        required: true,
        label: { zh: '四周挂件', en: 'Pegs' },
        admin: { initCollapsed: true },
        fields: [
          {
            name: 'pos',
            type: 'select',
            required: true,
            options: [
              { label: { zh: '左上', en: 'Position 1' }, value: 'p1' },
              { label: { zh: '右上', en: 'Position 2' }, value: 'p2' },
              { label: { zh: '左下', en: 'Position 3' }, value: 'p3' },
              { label: { zh: '右下', en: 'Position 4' }, value: 'p4' },
            ],
            label: { zh: '位置', en: 'Position' },
            admin: {
              description: {
                zh: '挂件锚点，渲染按 p1–p4 定坐标，不是序号。',
                en: 'Anchor slot: the renderer places p1-p4 at fixed coordinates.',
              },
            },
          },
          {
            name: 'icon',
            type: 'select',
            required: true,
            options: [
              { label: { zh: '任务', en: 'Task' }, value: 'task' },
              { label: { zh: '记忆', en: 'Memory' }, value: 'memory' },
              { label: { zh: '治理', en: 'Governance' }, value: 'gov' },
              { label: { zh: '扩展', en: 'Extension' }, value: 'ext' },
            ],
            label: { zh: '图标', en: 'Icon' },
          },
          { name: 'text', type: 'text', required: true, label: { zh: '文字', en: 'Text' } },
        ],
      },
    ],
  },
]

/**
 * 功能页文案（page-features）：一比一镜像 `features.ts` 的 `FeaturesContent`。
 * 能力版块的数据面板用 Payload blocks 承载五种形态（blocks/chips/bars/journey/agent），
 * 判别键即 block 的 blockType（等同原 `kind`），不另存 kind 字段。
 */
export const PageFeatures: CollectionConfig = {
  slug: 'page-features',
  labels: {
    singular: { zh: '功能页文案', en: 'Features Page Copy' },
    plural: { zh: '功能页文案', en: 'Features Page Copies' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['project', 'status', 'updatedAt'],
    description: {
      zh: '公开站功能全景页文案，一个项目一条记录；后台改完需重新构建公开站才生效。',
      en: 'Features page copy per project; rebuild the static site after editing.',
    },
  },
  access: pageCopyAccess,
  hooks: { beforeChange: [uniqueProjectPerCopy] },
  indexes: pageCopyIndexes,
  fields: [
    ...pageCopyCommonFields(),
    {
      name: 'meta',
      type: 'group',
      label: { zh: '页面元信息', en: 'Page Meta' },
      fields: [
        { name: 'title', type: 'text', required: true, label: { zh: '文档标题', en: 'Document Title' } },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: { zh: '文档描述', en: 'Document Description' },
        },
      ],
    },
    {
      name: 'hero',
      type: 'group',
      label: { zh: '首屏', en: 'Hero' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        {
          // 原 titleA + titleEm 两段式，按 design D4 折成与首页同形的可重复组。
          name: 'titleLines',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '主标题行', en: 'Title Lines' },
          admin: {
            initCollapsed: true,
            description: {
              zh: '逐行渲染主标题；勾选「强调」即按高亮样式渲染该行（原「主标题 + 强调标题」两段已并入此处）。',
              en: 'One entry per title line; emphasis renders that line highlighted (the old two-field split lives here now).',
            },
          },
          fields: [
            { name: 'text', type: 'text', required: true, label: { zh: '标题文字', en: 'Text' } },
            { name: 'emphasis', type: 'checkbox', label: { zh: '强调', en: 'Emphasis' } },
          ],
        },
        { name: 'description', type: 'textarea', required: true, label: { zh: '副文案', en: 'Description' } },
        {
          name: 'stats',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '首屏数字', en: 'Hero Stats' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'value', type: 'text', required: true, label: { zh: '数值', en: 'Value' } },
            { name: 'label', type: 'text', required: true, label: { zh: '口径', en: 'Label' } },
          ],
        },
      ],
    },
    {
      name: 'caps',
      type: 'array',
      required: true,
      label: { zh: '能力版块', en: 'Capabilities' },
      admin: {
        initCollapsed: true,
        description: {
          zh: '三站的能力条目数与面板形态顺序各不相同，条目本身可增删排序。',
          en: 'Entries and panel kinds differ per site; rows are reorderable.',
        },
      },
      fields: [
        { name: 'no', type: 'text', required: true, label: { zh: '编号', en: 'No.' } },
        { name: 'tag', type: 'text', required: true, label: { zh: '标签', en: 'Tag' } },
        {
          name: 'tagTone',
          type: 'select',
          options: [{ label: { zh: '云雀暖金', en: 'Yunque Gold' }, value: 'yb' }],
          label: { zh: '标签配色', en: 'Tag Tone' },
          admin: {
            description: {
              zh: '留空为默认标签样式；yb 为云雀暖金配色。',
              en: 'Blank keeps the default tag style; yb is the warm-gold variant.',
            },
          },
        },
        { name: 'title', type: 'text', required: true, label: { zh: '版块标题', en: 'Title' } },
        {
          name: 'reverse',
          type: 'checkbox',
          label: { zh: '左右镜像', en: 'Reverse' },
          admin: {
            description: {
              zh: '勾选后图文左右调换，用于打破整页单调。',
              en: 'Swap the text and panel sides for visual rhythm.',
            },
          },
        },
        {
          name: 'aside',
          type: 'group',
          label: { zh: '文字侧', en: 'Aside' },
          fields: [
            { name: 'p', type: 'textarea', required: true, label: { zh: '正文段落', en: 'Paragraph' } },
            { name: 'points', type: 'text', hasMany: true, required: true, label: { zh: '要点', en: 'Points' } },
          ],
        },
        {
          name: 'panel',
          type: 'blocks',
          required: true,
          minRows: 1,
          maxRows: 1,
          blocks: featurePanelBlocks,
          label: { zh: '数据面板', en: 'Data Panel' },
          admin: {
            description: {
              zh: '每个版块恰好一个面板形态（原 kind 判别值由 blockType 承载，不另存 kind）。',
              en: 'Exactly one panel per capability (blockType carries the original kind discriminator).',
            },
          },
        },
      ],
    },
    {
      name: 'base',
      type: 'group',
      label: { zh: '基础能力', en: 'Shared Base' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        {
          name: 'items',
          type: 'array',
          required: true,
          label: { zh: '能力条目', en: 'Items' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'title', type: 'text', required: true, label: { zh: '标题', en: 'Title' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '说明', en: 'Description' } },
          ],
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      label: { zh: '行动召唤', en: 'CTA' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '区块说明', en: 'Description' } },
        { name: 'btnText', type: 'text', required: true, label: { zh: '按钮文字', en: 'Button Text' } },
      ],
    },
  ],
}
