import type { CollectionConfig } from 'payload'

import { authenticated, everyone } from '../access'

/** 媒体库：统一管理文章封面、站点 Logo、用户头像等图片素材。 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: { zh: '媒体', en: 'Media' },
    plural: { zh: '媒体库', en: 'Media Library' },
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'mimeType', 'updatedAt'],
    description: {
      zh: '统一管理文章封面、站点 Logo、用户头像等图片素材。',
      en: 'Manage covers, site logos, avatars and other image assets.',
    },
  },
  access: {
    // 仅收录 image/*，供公开站封面/logo 直接展示，故保留匿名读；接受项（无 PII、仅图片字节）。
    read: everyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 800, height: 600, position: 'centre' },
      { name: 'banner', width: 1600, height: 900, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: { zh: '替代文本', en: 'Alt Text' },
      admin: {
        description: {
          zh: '图片的替代文本（无障碍可用性），主图建议填写。',
          en: 'Accessibility alternative text; recommended for main images.',
        },
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: { zh: '说明文字', en: 'Caption' },
      admin: {
        description: { zh: '图片下方显示的说明文字（可选）。', en: 'Optional caption below the image.' },
      },
    },
  ],
}