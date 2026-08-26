'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * 自定义页面（intake / dashboard）的轻量国际化。
 * 复用 Payload 的语言偏好 cookie `payload-lng`，即跟随后台管理员选的语言；
 * 撰写 `payload-lng` 同名 cookie，保证后台与这些运营页语言一致，无需引入新依赖。
 */

export type Lang = 'zh' | 'en'

/** 文案字典：key -> { zh, en }，与项目中"文案一律 {zh,en} 双语"规范保持一致。 */
export type Dict = Record<string, { zh: string; en: string }>

const COOKIE = 'payload-lng'

function readCookieLang(): Lang {
  if (typeof document === 'undefined') return 'zh'
  const pair = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
  return pair?.split('=')[1] === 'en' ? 'en' : 'zh'
}

function writeCookieLang(lang: Lang) {
  document.cookie = `${COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`
}

type LocaleValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleValue | null>(null)

type I18nProviderProps = {
  dict: Dict
  /** 语言切换时同步更新的 document.title，键值与 dict 同语言键。 */
  titles?: { zh: string; en: string }
  children: ReactNode
}

export function I18nProvider({ dict, titles, children }: I18nProviderProps) {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    const next = readCookieLang()
    setLangState(next)
    applyDocument(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyDocument(next: Lang) {
    document.documentElement.lang = next
    if (titles) document.title = next === 'zh' ? titles.zh : titles.en
  }

  const setLang = useCallback(
    (next: Lang) => {
      writeCookieLang(next)
      setLangState(next)
      applyDocument(next)
    },
    [titles],
  )

  const t = useCallback((key: string) => dict[key]?.[lang] ?? key, [dict, lang])

  return <LocaleContext.Provider value={{ lang, setLang, t }}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale 必须在 <I18nProvider> 内使用')
  return ctx
}

const switchStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  background: '#fff',
  border: '1px solid #e6e8ec',
  borderRadius: 8,
  fontSize: 13,
}
const switchItemStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: 'none',
  background: 'transparent',
  color: '#6b7380',
  borderRadius: 5,
  cursor: 'pointer',
}
const switchItemActiveStyle: React.CSSProperties = {
  ...switchItemStyle,
  background: '#eef3f0',
  color: '#2f5d47',
  fontWeight: 600,
}

/** 页面右上角的中/英语言切换器，写入与后台一致的 payload-lng cookie。 */
export function LangSwitcher() {
  const { lang, setLang } = useLocale()
  return (
    <div style={switchStyle}>
      <button
        type="button"
        style={lang === 'zh' ? switchItemActiveStyle : switchItemStyle}
        onClick={() => setLang('zh')}
      >
        中
      </button>
      <button
        type="button"
        style={lang === 'en' ? switchItemActiveStyle : switchItemStyle}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  )
}