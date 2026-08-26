/** 线索来源取值（受控枚举，单一真值源）。 */
const SOURCE_VALUES = ['website', 'campaign', 'douyin', 'xiaohongshu', 'manual', 'support', 'referral'] as const
export type LeadSourceValue = (typeof SOURCE_VALUES)[number]

/** 校验用取值集合（string[] 便于 includes 校验）。 */
export const LEAD_SOURCE_VALUES: string[] = [...SOURCE_VALUES]

/** 后台 select 选项：前端与 API 共用同一份取值。 */
export const LEAD_SOURCES: { label: { zh: string; en: string }; value: LeadSourceValue }[] = [
  { label: { zh: '官网表单', en: 'Website' }, value: 'website' },
  { label: { zh: '渠道活动', en: 'Campaign' }, value: 'campaign' },
  { label: { zh: '抖音', en: 'Douyin' }, value: 'douyin' },
  { label: { zh: '小红书', en: 'Xiaohongshu' }, value: 'xiaohongshu' },
  { label: { zh: '手动录入', en: 'Manual' }, value: 'manual' },
  { label: { zh: '客服收件', en: 'Support' }, value: 'support' },
  { label: { zh: '他人推荐', en: 'Referral' }, value: 'referral' },
]