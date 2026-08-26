import React from 'react'

/** 后台 Logo：觉策增长的菱形体标识 + 品牌字。 */
export function Logo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '4px 0',
      }}
    >
      <Icon />
      <span
        style={{
          fontSize: '17px',
          fontWeight: 700,
          color: '#1a2326',
          whiteSpace: 'nowrap',
        }}
      >
        觉策增长
      </span>
    </div>
  )
}

/** 后台图标：与觉策青品牌一致的菱形。 */
export function Icon() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2f8f96" />
      <path
        d="M10 22V12L16 8L22 12V22L16 26L10 22Z"
        stroke="#ffffff"
        strokeWidth="1.8"
        fill="none"
      />
      <circle cx="16" cy="17" r="3" fill="#ffffff" opacity="0.85" />
    </svg>
  )
}

export default Logo