import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type Locale = 'zh' | 'en'

type TranslationMap = Record<string, string>

const translations: Record<Locale, TranslationMap> = {
  zh: {},
  en: {},
}

// ── Register translations ──

let _zh: TranslationMap = {}
let _en: TranslationMap = {}

export function registerTranslations(zh: TranslationMap, en: TranslationMap) {
  Object.assign(_zh, zh)
  Object.assign(_en, en)
  translations.zh = _zh
  translations.en = _en
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

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(LOCALE_KEY)
    return stored === 'en' ? 'en' : 'zh'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(LOCALE_KEY, l)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = translations[locale]?.[key]
      if (!value) return key
      return interpolate(value, params)
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
