import type { FC } from 'react'
import type { DefaultCellComponentProps } from 'payload'

/** 状态 -> 徽章语义色调（对应 custom.scss 的 .admin-badge.tone-*）。 */
const TONE: Record<string, string> = {
  new: 'teal',
  contacted: 'amber',
  converted: 'green',
  closed: 'gray',
}

const LABEL: Record<string, string> = {
  new: '新线索',
  contacted: '跟进中',
  converted: '已成交',
  closed: '已关闭',
}

export const StatusCell: FC<DefaultCellComponentProps> = ({ cellData }) => {
  const value = String(cellData ?? '')
  const tone = TONE[value] || 'gray'
  return <span className={`admin-badge tone-${tone}`}>{LABEL[value] || value || '–'}</span>
}