import { buildConfig, type Block } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  BlocksFeature,
  BoldFeature,
  ChecklistFeature,
  EXPERIMENTAL_TableFeature,
  HorizontalRuleFeature,
  InlineCodeFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Users } from './collections/Users'
import { Projects } from './collections/Projects'
import { Sites } from './collections/Sites'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Articles } from './collections/Articles'
import { Forms } from './collections/Forms'
import { Leads } from './collections/Leads'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// 文章正文可用的内容块：让非技术运营也能自由拼装页面段落。
const blocks: Block[] = [
  {
    slug: 'callout',
    labels: {
      singular: { zh: '提示框', en: 'Callout' },
      plural: { zh: '提示框', en: 'Callouts' },
    },
    fields: [
      {
        name: 'body',
        type: 'textarea',
        required: true,
        label: { zh: '内容', en: 'Body' },
      },
    ],
  },
  {
    slug: 'twoColumns',
    labels: {
      singular: { zh: '两栏内容', en: 'Two Columns' },
      plural: { zh: '两栏内容', en: 'Two Columns' },
    },
    fields: [
      {
        name: 'left',
        type: 'textarea',
        label: { zh: '左栏', en: 'Left' },
      },
      {
        name: 'right',
        type: 'textarea',
        label: { zh: '右栏', en: 'Right' },
      },
    ],
  },
]

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '- 觉策增长运营后台',
    },
    components: {
      graphics: {
        Logo: {
          path: './components/Logo.tsx',
          exportName: 'Logo',
        },
        Icon: {
          path: './components/Logo.tsx',
          exportName: 'Icon',
        },
      },
      views: {
        dashboard: {
          Component: {
            path: './components/Dashboard.tsx',
            exportName: 'JueceDashboard',
          },
        },
      },
      beforeNavLinks: [
        {
          path: './components/NavDashboardLink.tsx',
          exportName: 'NavDashboardLink',
        },
      ],
    },
  },
  collections: [
    {
      ...Leads,
      admin: {
        ...Leads.admin,
        group: { zh: '客户与线索', en: 'Customers & Leads' },
      },
    },
    {
      ...Projects,
      admin: {
        ...Projects.admin,
        group: { zh: '内容与站点', en: 'Content & Sites' },
      },
    },
    {
      ...Sites,
      admin: {
        ...Sites.admin,
        group: { zh: '内容与站点', en: 'Content & Sites' },
      },
    },
    {
      ...Categories,
      admin: {
        ...Categories.admin,
        group: { zh: '内容与站点', en: 'Content & Sites' },
      },
    },
    {
      ...Media,
      admin: {
        ...Media.admin,
        group: { zh: '内容与站点', en: 'Content & Sites' },
      },
    },
    {
      ...Articles,
      admin: {
        ...Articles.admin,
        group: { zh: '内容与站点', en: 'Content & Sites' },
      },
    },
    {
      ...Forms,
      admin: {
        ...Forms.admin,
        group: { zh: '内容与站点', en: 'Content & Sites' },
      },
    },
    {
      ...Users,
      admin: {
        ...Users.admin,
        group: { zh: '系统', en: 'System' },
      },
    },
  ],
  editor: lexicalEditor({
    features: [
      ParagraphFeature(),
      BoldFeature(),
      ItalicFeature(),
      InlineCodeFeature(),
      HorizontalRuleFeature(),
      ChecklistFeature(),
      LinkFeature(),
      OrderedListFeature(),
      UnorderedListFeature(),
      BlocksFeature({
        blocks,
      }),
      UploadFeature({
        collections: {
          media: { fields: [] },
        },
        maxDepth: 2,
      }),
      EXPERIMENTAL_TableFeature(),
    ],
  }),
  i18n: {
    supportedLanguages: {
      en,
      zh,
    },
    fallbackLanguage: 'zh',
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
})