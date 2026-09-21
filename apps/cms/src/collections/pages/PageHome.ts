import type { CollectionConfig } from 'payload'

import { ACTION_OPTIONS, ICON_OPTIONS, pageCopyAccess, pageCopyCommonFields, pageCopyIndexes, uniqueProjectPerCopy } from './pageCopyShared'

/**
 * 首页文案（page-home）：一比一镜像 `apps/astro/src/types/pages/home.ts` 的 `HomeContent`。
 * 站归属用 `project`；`hero.titleLines` / `hero.stats` / `cta.rows` 后台拖拽即排序（展示序 = 数组索引序）；
 * 位置耦合的列表在 schema 上锁死长度，避免放开增删后渲染错位。
 */
export const PageHome: CollectionConfig = {
  slug: 'page-home',
  labels: {
    singular: { zh: '首页文案', en: 'Home Page Copy' },
    plural: { zh: '首页文案', en: 'Home Page Copies' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['project', 'status', 'updatedAt'],
    description: {
      zh: '公开站首页各区块文案，一个项目一条记录；后台改完需重新构建公开站才生效。',
      en: 'Home page copy per project; rebuild the static site after editing.',
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
          name: 'titleLines',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '主标题行', en: 'Title Lines' },
          admin: {
            initCollapsed: true,
            description: {
              zh: '逐行渲染主标题，可增删与拖拽排序；勾选「强调」即按高亮样式渲染该行。',
              en: 'One entry per title line; reorder freely. Emphasis renders the line highlighted.',
            },
          },
          fields: [
            { name: 'text', type: 'text', required: true, label: { zh: '标题文字', en: 'Text' } },
            {
              // 原 `em?: boolean`，按 design D4 与其余三页统一为 `emphasis`（渲染器只留一种循环）。
              name: 'emphasis',
              type: 'checkbox',
              label: { zh: '强调', en: 'Emphasis' },
            },
          ],
        },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '副文案', en: 'Description' } },
        {
          name: 'primary',
          type: 'group',
          label: { zh: '主按钮', en: 'Primary Button' },
          fields: [
            { name: 'label', type: 'text', required: true, label: { zh: '按钮文字', en: 'Label' } },
            {
              name: 'action',
              type: 'select',
              required: true,
              options: ACTION_OPTIONS,
              label: { zh: '按钮行为', en: 'Action' },
            },
            {
              name: 'href',
              type: 'text',
              label: { zh: '跳转地址', en: 'Href' },
              admin: {
                description: {
                  zh: '行为为「跳转链接」时填写；站内用 /path/，站外用 //host/。',
                  en: 'Used when action is a link: /path/ internal, //host/ external.',
                },
              },
            },
          ],
        },
        {
          name: 'secondary',
          type: 'group',
          label: { zh: '次按钮', en: 'Secondary Button' },
          fields: [
            { name: 'label', type: 'text', required: true, label: { zh: '按钮文字', en: 'Label' } },
            { name: 'href', type: 'text', required: true, label: { zh: '跳转地址', en: 'Href' } },
          ],
        },
        {
          name: 'stats',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '首屏要点', en: 'Hero Stats' },
          admin: {
            initCollapsed: true,
            description: {
              zh: '首屏三条要点，逐条渲染；可增删与拖拽排序。',
              en: 'Hero bullet points, rendered in list order.',
            },
          },
          fields: [
            { name: 'strong', type: 'text', required: true, label: { zh: '要点标题', en: 'Strong' } },
            { name: 'span', type: 'text', required: true, label: { zh: '要点说明', en: 'Span' } },
          ],
        },
        {
          name: 'diagram',
          type: 'group',
          label: { zh: '结构图', en: 'Diagram' },
          fields: [
            { name: 'coreName', type: 'text', required: true, label: { zh: '核心名', en: 'Core Name' } },
            { name: 'coreSub', type: 'text', required: true, label: { zh: '核心副名', en: 'Core Sub' } },
            {
              name: 'nodes',
              type: 'array',
              required: true,
              maxRows: 3,
              label: { zh: '节点', en: 'Nodes' },
              admin: {
                initCollapsed: true,
                description: {
                  zh: '最多 3 个：渲染按索引取 y 偏移（92 + i×112）且 viewBox 固定，超出会画出画布。',
                  en: 'Max 3: the renderer stacks y offsets (92 + i*112) inside a fixed viewBox; more overflow.',
                },
              },
              fields: [
                { name: 'no', type: 'text', required: true, label: { zh: '编号', en: 'No.' } },
                { name: 'name', type: 'text', required: true, label: { zh: '节点名', en: 'Name' } },
                { name: 'sub', type: 'text', required: true, label: { zh: '节点说明', en: 'Sub' } },
                {
                  name: 'tone',
                  type: 'select',
                  required: true,
                  options: ICON_OPTIONS,
                  label: { zh: '配色产品线', en: 'Tone' },
                },
              ],
            },
            {
              name: 'chips',
              type: 'text',
              hasMany: true,
              required: true,
              minRows: 3,
              maxRows: 3,
              label: { zh: '标签条', en: 'Chips' },
              admin: {
                description: {
                  zh: '固定 3 条：渲染把第 1/2/3 项硬映射到 chip-a/b/c 三个位置，多出的会被丢弃、缺的会空位。',
                  en: 'Exactly 3: the renderer maps items 1/2/3 to chip-a/b/c slots; extras are dropped, gaps left blank.',
                },
              },
            },
          ],
        },
      ],
    },
    {
      name: 'products',
      type: 'group',
      label: { zh: '产品矩阵', en: 'Products' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '区块说明', en: 'Description' } },
        {
          name: 'spotlight',
          type: 'group',
          label: { zh: '主推产品', en: 'Spotlight' },
          fields: [
            { name: 'tag', type: 'text', required: true, label: { zh: '标签', en: 'Tag' } },
            {
              name: 'icon',
              type: 'select',
              required: true,
              options: ICON_OPTIONS,
              label: { zh: '产品线', en: 'Icon' },
            },
            { name: 'name', type: 'text', required: true, label: { zh: '产品名', en: 'Name' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '产品说明', en: 'Description' } },
            {
              name: 'points',
              type: 'text',
              hasMany: true,
              required: true,
              label: { zh: '能力要点', en: 'Points' },
            },
            {
              name: 'link',
              type: 'group',
              label: { zh: '入口链接', en: 'Link' },
              fields: [
                { name: 'label', type: 'text', required: true, label: { zh: '链接文字', en: 'Label' } },
                { name: 'href', type: 'text', required: true, label: { zh: '跳转地址', en: 'Href' } },
                { name: 'external', type: 'checkbox', label: { zh: '站外链接', en: 'External' } },
              ],
            },
          ],
        },
        {
          name: 'side',
          type: 'array',
          required: true,
          label: { zh: '并列产品', en: 'Side Products' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'tag', type: 'text', required: true, label: { zh: '标签', en: 'Tag' } },
            {
              name: 'icon',
              type: 'select',
              required: true,
              options: ICON_OPTIONS,
              label: { zh: '产品线', en: 'Icon' },
            },
            { name: 'name', type: 'text', required: true, label: { zh: '产品名', en: 'Name' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '产品说明', en: 'Description' } },
            {
              name: 'link',
              type: 'group',
              label: { zh: '入口链接', en: 'Link' },
              fields: [
                { name: 'label', type: 'text', required: true, label: { zh: '链接文字', en: 'Label' } },
                { name: 'href', type: 'text', required: true, label: { zh: '跳转地址', en: 'Href' } },
                { name: 'external', type: 'checkbox', label: { zh: '站外链接', en: 'External' } },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'solutions',
      type: 'group',
      label: { zh: '行业与场景', en: 'Solutions' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        {
          name: 'heading',
          type: 'textarea',
          required: true,
          label: { zh: '标题', en: 'Heading' },
          admin: {
            description: {
              zh: '允许换行：换行处渲染为 <br>，原样保存，不做转义或折叠。',
              en: 'Newlines allowed: rendered as <br>; stored verbatim.',
            },
          },
        },
        { name: 'moreLabel', type: 'text', required: true, label: { zh: '更多按钮文字', en: 'More Label' } },
        { name: 'moreHref', type: 'text', required: true, label: { zh: '更多跳转地址', en: 'More Href' } },
        {
          name: 'rows',
          type: 'array',
          required: true,
          label: { zh: '行业条目', en: 'Rows' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'title', type: 'text', required: true, label: { zh: '标题', en: 'Title' } },
            { name: 'audience', type: 'text', required: true, label: { zh: '适用人群', en: 'Audience' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '说明', en: 'Description' } },
            {
              name: 'points',
              type: 'text',
              hasMany: true,
              required: true,
              label: { zh: '要点', en: 'Points' },
            },
          ],
        },
      ],
    },
    {
      name: 'cases',
      type: 'group',
      label: { zh: '真实用法', en: 'Cases' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        {
          name: 'heading',
          type: 'textarea',
          required: true,
          label: { zh: '标题', en: 'Heading' },
          admin: {
            description: {
              zh: '允许换行：换行处渲染为 <br>，原样保存，不做转义或折叠。',
              en: 'Newlines allowed: rendered as <br>; stored verbatim.',
            },
          },
        },
        {
          name: 'feature',
          type: 'group',
          label: { zh: '主案例', en: 'Featured Case' },
          fields: [
            { name: 'band', type: 'text', required: true, label: { zh: '所属产品', en: 'Band' } },
            { name: 'title', type: 'text', required: true, label: { zh: '标题', en: 'Title' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '说明', en: 'Description' } },
            {
              name: 'metrics',
              type: 'array',
              required: true,
              label: { zh: '指标', en: 'Metrics' },
              admin: { initCollapsed: true },
              fields: [
                { name: 'value', type: 'text', required: true, label: { zh: '数值', en: 'Value' } },
                { name: 'label', type: 'text', required: true, label: { zh: '口径', en: 'Label' } },
              ],
            },
          ],
        },
        {
          name: 'minis',
          type: 'array',
          required: true,
          maxRows: 2,
          label: { zh: '次案例', en: 'Mini Cases' },
          admin: {
            initCollapsed: true,
            description: {
              zh: '最多 2 条：渲染标签按索引取「A」「B」两个位置，第 3 条会渲染出 undefined。',
              en: 'Max 2: labels come from an A/B pair by index, so a third entry renders undefined.',
            },
          },
          fields: [
            { name: 'band', type: 'text', required: true, label: { zh: '所属产品', en: 'Band' } },
            {
              name: 'tone',
              type: 'select',
              options: ICON_OPTIONS,
              label: { zh: '配色产品线', en: 'Tone' },
              admin: {
                description: {
                  zh: '留空表示用默认配色（仅部分卡片指定配色）。',
                  en: 'Blank keeps the default styling (only some cards set a tone).',
                },
              },
            },
            { name: 'title', type: 'text', required: true, label: { zh: '标题', en: 'Title' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '说明', en: 'Description' } },
            { name: 'tag', type: 'text', required: true, label: { zh: '标签', en: 'Tag' } },
          ],
        },
      ],
    },
    {
      name: 'resource',
      type: 'group',
      label: { zh: '先看看', en: 'Resources' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '区块说明', en: 'Description' } },
        {
          name: 'links',
          type: 'array',
          required: true,
          label: { zh: '入口链接', en: 'Links' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'title', type: 'text', required: true, label: { zh: '标题', en: 'Title' } },
            { name: 'sub', type: 'text', required: true, label: { zh: '副文案', en: 'Sub' } },
            { name: 'href', type: 'text', required: true, label: { zh: '跳转地址', en: 'Href' } },
            { name: 'external', type: 'checkbox', label: { zh: '站外链接', en: 'External' } },
          ],
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      label: { zh: '入口选择', en: 'CTA' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '区块说明', en: 'Description' } },
        {
          name: 'rows',
          type: 'array',
          required: true,
          minRows: 1,
          label: { zh: '入口行', en: 'Rows' },
          admin: {
            initCollapsed: true,
            description: {
              zh: '逐条渲染，可增删与拖拽排序；顺序即页面展示顺序。',
              en: 'Rendered in list order; reorder freely in admin.',
            },
          },
          fields: [
            {
              name: 'icon',
              type: 'select',
              required: true,
              options: ICON_OPTIONS,
              label: { zh: '产品线', en: 'Icon' },
            },
            { name: 'head', type: 'text', required: true, label: { zh: '标题', en: 'Head' } },
            { name: 'desc', type: 'textarea', required: true, label: { zh: '说明', en: 'Description' } },
            { name: 'act', type: 'text', required: true, label: { zh: '按钮文字', en: 'Act' } },
            {
              name: 'action',
              type: 'select',
              required: true,
              options: ACTION_OPTIONS,
              label: { zh: '按钮行为', en: 'Action' },
            },
            { name: 'href', type: 'text', label: { zh: '跳转地址', en: 'Href' } },
            { name: 'external', type: 'checkbox', label: { zh: '站外链接', en: 'External' } },
          ],
        },
      ],
    },
    {
      name: 'blog',
      type: 'group',
      label: { zh: '内容区', en: 'Blog' },
      fields: [
        { name: 'kicker', type: 'text', required: true, label: { zh: '眉题', en: 'Kicker' } },
        { name: 'heading', type: 'textarea', required: true, label: { zh: '标题', en: 'Heading' } },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '区块说明', en: 'Description' } },
      ],
    },
  ],
}
