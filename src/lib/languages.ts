// ── Language registry ──
//
// Add a new language by appending one entry below. Anywhere that needs to
// support all languages (TTS voice selection, text rendering, translation
// prompts, dropdown menus, …) iterates over this list, so a new language
// is a single-line change.

export type LangCode = 'zh' | 'en' | 'ja' | 'ko' | 'fr'

export interface LanguageDef {
  /** 内部语言代码（与 BCP 47 主子标签一致） */
  code: LangCode
  /** 用户可见名称（简体中文，用于 UI 列表） */
  label: string
  /** 本地化名称（用该语言自身书写） */
  labelNative: string
  /** 国旗/标识 emoji */
  flag: string
  /** 浏览器 SpeechSynthesis voice.lang 的匹配前缀 */
  ttsPrefix: string
  /** 翻译提示中对该语言的英文描述（"English / Japanese / …"） */
  translateName: string
  /** 该语言使用的母语对应名称（用于系统提示） */
  nativeName: string
  /** 数据模型中除 zh/en 外对应的字段名后缀（首字母大写），例如 Ja/Ko/Fr */
  fieldSuffix: string
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'zh', label: '中文',      labelNative: '中文',     flag: '🇨🇳', ttsPrefix: 'zh', translateName: 'Chinese (Simplified)', nativeName: '简体中文', fieldSuffix: '' },
  { code: 'en', label: '英语',      labelNative: 'English',  flag: '🇺🇸', ttsPrefix: 'en', translateName: 'English',              nativeName: 'English',  fieldSuffix: 'En' },
  { code: 'ja', label: '日语',      labelNative: '日本語',   flag: '🇯🇵', ttsPrefix: 'ja', translateName: 'Japanese',             nativeName: '日本語',   fieldSuffix: 'Ja' },
  { code: 'ko', label: '韩语',      labelNative: '한국어',   flag: '🇰🇷', ttsPrefix: 'ko', translateName: 'Korean',               nativeName: '한국어',   fieldSuffix: 'Ko' },
  { code: 'fr', label: '法语',      labelNative: 'Français', flag: '🇫🇷', ttsPrefix: 'fr', translateName: 'French',               nativeName: 'Français', fieldSuffix: 'Fr' },
]

export const LANG_CODES: LangCode[] = LANGUAGES.map((l) => l.code)

export const LANG_BY_CODE: Record<LangCode, LanguageDef> = LANGUAGES.reduce(
  (acc, l) => { acc[l.code] = l; return acc },
  {} as Record<LangCode, LanguageDef>,
)

/** 用 LangCode 生成数据字段名：zh→text, en→textEn, ja→textJa, ... */
export function localizedFieldName(code: LangCode): string {
  if (code === 'zh') return 'text'
  return `text${LANG_BY_CODE[code].fieldSuffix}`
}

/** 在多语言字段中按优先级取值。preferred → fallback → 其他语言 → 空串 */
export function pickLocalizedText(
  fields: Record<string, string | undefined> | undefined,
  preferred: LangCode,
  fallback: LangCode = 'zh',
): string {
  if (!fields) return ''
  if (fields[preferred]?.trim()) return fields[preferred] as string
  if (fields[fallback]?.trim()) return fields[fallback] as string
  for (const c of LANG_CODES) {
    if (fields[c]?.trim()) return fields[c] as string
  }
  return ''
}

/** 把 BookItem 中的 LocalizedValue 字段转成扁平 {text, textEn, textJa, ...} 形式 */
export function flattenLocalizedValue(v: { text: string; [k: string]: string | string[] | undefined } | undefined): Record<string, string | undefined> {
  if (!v) return {}
  const out: Record<string, string | undefined> = {}
  for (const code of LANG_CODES) {
    const key = localizedFieldName(code)
    const val = v[key]
    if (typeof val === 'string') out[code] = val
  }
  return out
}

/** 浏览器 SpeechSynthesis voice 列表里挑出匹配指定语言的最优声音 */
export function pickVoiceForLang(
  voices: SpeechSynthesisVoice[],
  code: LangCode,
  storedName?: string,
): SpeechSynthesisVoice | null {
  const def = LANG_BY_CODE[code]
  if (!def) return null
  if (storedName) {
    const exact = voices.find((v) => v.name === storedName)
    if (exact) return exact
  }
  const prefix = def.ttsPrefix
  const exactPrefix = voices.find((v) => v.lang.toLowerCase() === prefix.toLowerCase())
  if (exactPrefix) return exactPrefix
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase())) ?? null
}
