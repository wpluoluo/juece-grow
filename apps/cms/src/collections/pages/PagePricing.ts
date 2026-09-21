import type { CollectionConfig } from 'payload'

import { pageCopyAccess, pageCopyCommonFields, pageCopyIndexes, uniqueProjectPerCopy } from './pageCopyShared'

/**
 * 价格文案保持字面对齐：渲染层用 `/^[0-9]+$/` 判定「这是金额」（才配货币符号与单位），
 * 否则原样展示（如「面议」「按团队」）。故这里存文本，并挡掉「3,999 元」这类半数字半文案的混合写法——
 * 它两边都不像，渲染出来会与其它档位的金额格式不一致。
 */
const DIGITS_ONLY = /^[0-9]+$/

function validatePrice(value: unknown): true | string {
  if (value == null || value === '') return true
  const text = String(value)
  if (DIGITS_ONLY.test(text)) return true
  return /\d/.test(text) ? '金额请只填数字（如 3999），或用纯文字表述（如「面议」「按团队」）' : true
}

/**
 * 价格页文案（page-pricing）：一比一镜像 `pricing.ts` 的 `PricingContent`。
 * 三站差异最大（`unit` 仅智云用、`currency` 三站均未填、`price` 有金额与文字两种形态、档位权益条数不一），
 * 因此可选字段一律留空而非按站裁剪。
 */
export const PagePricing: CollectionConfig = {
  slug: 'page-pricing',
  labels: {
    singular: { zh: '价格页文案', en: 'Pricing Page Copy' },
    plural: { zh: '价格页文案', en: 'Pricing Page Copies' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['project', 'status', 'updatedAt'],
    description: {
      zh: '公开站价格页文案（档位、跨产品入口、FAQ），一个项目一条记录；改完需重新构建公开站。',
      en: 'Pricing page copy per project (plans, cross-product links, FAQ); rebuild the static site after editing.',
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
      ],
    },
    {
      name: 'plans',
      type: 'array',
      required: true,
      label: { zh: '价格档位', en: 'Plans' },
      admin: {
        initCollapsed: true,
        description: {
          zh: '三站各三档但计费口径独立（智云按年 / ERP 按项目授权 / 云雀按团队），条目可增删排序。',
          en: 'Three plans per site with independent billing models; rows are reorderable.',
        },
      },
      fields: [
        { name: 'name', type: 'text', required: true, label: { zh: '档位名', en: 'Name' } },
        {
          name: 'price',
          type: 'text',
          required: true,
          validate: validatePrice,
          label: { zh: '价格', en: 'Price' },
        },
        {
          name: 'unit',
          type: 'text',
          label: { zh: '计费单位', en: 'Unit' },
          admin: {
            description: {
              zh: '金额单位，如「/年」；按项目授权或面议的档位留空。',
              en: 'Billing unit such as /year; blank for per-project or quote-based plans.',
            },
          },
        },
        {
          name: 'currency',
          type: 'text',
          label: { zh: '货币符号', en: 'Currency' },
          admin: {
            description: {
              zh: '货币符号，留空由渲染层按默认「¥」处理；面议场景留空。',
              en: 'Currency glyph; blank falls through to the renderer default of ¥. Leave blank for quotes.',
            },
          },
        },
        { name: 'desc', type: 'textarea', required: true, label: { zh: '档位说明', en: 'Description' } },
        { name: 'btnText', type: 'text', required: true, label: { zh: '按钮文字', en: 'Button Text' } },
        {
          name: 'highlight',
          type: 'checkbox',
          label: { zh: '重点档', en: 'Highlight' },
          admin: {
            description: {
              zh: '勾选后该档卡片用强调样式，并可配角标文案。',
              en: 'Renders this card emphasized, with an optional badge.',
            },
          },
        },
        {
          name: 'recTag',
          type: 'text',
          label: { zh: '推荐角标', en: 'Recommend Tag' },
          admin: {
            description: {
              zh: '高亮卡片右上角文案，如「重点推荐」「多数选择」；留空由渲染层用默认「重点推荐」。',
              en: 'Badge on the highlighted card, e.g. 重点推荐; blank uses the renderer default.',
            },
          },
        },
        { name: 'features', type: 'text', hasMany: true, required: true, label: { zh: '权益条目', en: 'Features' } },
      ],
    },
    {
      name: 'eco',
      type: 'group',
      label: { zh: '跨产品入口', en: 'Ecosystem' },
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
            { name: 'label', type: 'text', required: true, label: { zh: '链接文字', en: 'Label' } },
            { name: 'href', type: 'text', required: true, label: { zh: '跳转地址', en: 'Href' } },
            {
              name: 'ghost',
              type: 'checkbox',
              label: { zh: '次要样式', en: 'Ghost' },
              admin: {
                description: { zh: '勾选为描边次要按钮，用于并列的次要入口。', en: 'Outlined secondary button styling.' },
              },
            },
          ],
        },
      ],
    },
    {
      name: 'faqs',
      type: 'array',
      required: true,
      label: { zh: '常见问题', en: 'FAQs' },
      admin: {
        initCollapsed: true,
        description: { zh: '逐条渲染，条目可增删排序。', en: 'Rendered in list order; rows are reorderable.' },
      },
      fields: [
        { name: 'q', type: 'text', required: true, label: { zh: '问题', en: 'Question' } },
        { name: 'a', type: 'textarea', required: true, label: { zh: '回答', en: 'Answer' } },
      ],
    },
  ],
}
