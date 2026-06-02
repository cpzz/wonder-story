import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { LangCode } from '@/lib/languages'

/** UI locale 与多语言朗读的 LangCode 保持一致。 */
export type Locale = LangCode

type TranslationMap = Record<string, string>

/** 所有 5 种 UI 语言的翻译表。zh/en 由 registerTranslations 注入；ja/ko/fr 暂留空，
 *  t() 会按 fallback 链 locale → 'en' → 'zh' → key 自动回退。
 *  未来要加日文/韩文/法文 UI 文案，只需要在 locales.ts 里再 register 一次即可。 */
const translations: Record<Locale, TranslationMap> = {
  zh: {},
  en: {},
  ja: {},
  ko: {},
  fr: {},
}

// ── Register translations ──

const _maps: Record<Locale, TranslationMap> = {
  zh: {}, en: {}, ja: {}, ko: {}, fr: {},
}

/** 注册每种语言的翻译。5 种语言可独立注册；未注册的语言走 fallback 链。 */
export function registerTranslations(maps: Partial<Record<Locale, TranslationMap>>) {
  for (const code of Object.keys(maps) as Locale[]) {
    Object.assign(_maps[code], maps[code])
  }
  for (const code of Object.keys(_maps) as Locale[]) {
    translations[code] = _maps[code]
  }
}

// ── Context ──

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
})

const LOCALE_KEY = 'wstory_locale'

/** 判断 locale 是否属于"英文生态"，用于未迁移到 i18n 的内联英文回退。 */
export function isLatinLocale(locale: Locale): boolean {
  return locale !== 'zh'
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null
    if (stored && stored in translations) return stored
    return 'zh'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(LOCALE_KEY, l)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      // 1. 先查用户当前 locale 的字典
      let value = translations[locale]?.[key]
      if (value) return interpolate(value, params)
      // 2. 未命中：按 fallback 链回退
      //    非中文用户：先 en 后 zh；en/zh 用户：互为 fallback
      const fallbackOrder: Locale[] = locale === 'zh' ? ['en'] : locale === 'en' ? ['zh'] : ['en', 'zh']
      for (const fb of fallbackOrder) {
        value = translations[fb]?.[key]
        if (value) return interpolate(value, params)
      }
      return key
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export { I18nContext }
