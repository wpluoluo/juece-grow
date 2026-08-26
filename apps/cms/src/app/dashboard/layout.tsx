import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '线索看板 · 觉策增长',
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}