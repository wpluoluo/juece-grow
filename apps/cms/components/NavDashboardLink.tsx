'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation.js'
import React from 'react'

/**
 * 导航里的「运营工作台」入口：使用与集合链接完全相同的 nav__link 样式，
 * 置顶在分组之上，与其余导航项观感一致。
 */
export function NavDashboardLink() {
  const pathname = usePathname()
  const isActive = pathname === '/admin'

  return (
    <Link
      className={`nav__link nav__link--dashboard${isActive ? ' nav__link--active' : ''}`}
      href="/admin"
      prefetch={false}
    >
      <span className="nav__link-icon" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      </span>
      <span className="nav__link-label">运营工作台</span>
    </Link>
  )
}