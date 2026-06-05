// ── Language registry ──
//
// Add a new language by appending one entry below. Anywhere that needs to
// support all languages (TTS voice selection, text rendering, translation
// prompts, dropdown menus, …) iterates over this list, so a new language
// is a single-line change.

export type LangCode = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'fi' | 'es' | 'pt' | 'de' | 'pl' | 'it' | 'ar' | 'da' | 'hi' | 'th' | 'ru' | 'el' | 'ms'

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
  /**
   * 按当前 UI 语言显示的语言名。
   * UI 是中文 → 显示"中文/英文/日文/韩文/法文"
   * UI 是英文 → 显示"Chinese/English/Japanese/Korean/French"
   * 其它 UI 语言同理。
   * UI 语言不在映射中时回退到 labelNative。
   */
  i18nLabel: Record<LangCode, string>
}

export const LANGUAGES: LanguageDef[] = [
  {
    code: 'zh',
    label: '中文',
    labelNative: '中文',
    flag: '🇨🇳',
    ttsPrefix: 'zh',
    translateName: 'Chinese (Simplified)',
    nativeName: '简体中文',
    fieldSuffix: '',
    i18nLabel: { zh: '中文', en: 'Chinese',  ja: '中国語',   ko: '중국어',   fr: 'Chinois',   fi: 'kiina',       es: 'Chino',       pt: 'Chinês',         de: 'Chinesisch',   pl: 'Chiński',      it: 'Cinese',     ar: 'صيني',         da: 'Kinesisk',   hi: 'चीनी'         },
  },
  {
    code: 'en',
    label: '英语',
    labelNative: 'English',
    flag: '🇺🇸',
    ttsPrefix: 'en',
    translateName: 'English',
    nativeName: 'English',
    fieldSuffix: 'En',
    i18nLabel: { zh: '英文', en: 'English',  ja: '英語',     ko: '영어',     fr: 'Anglais',   fi: 'englanti',    es: 'Inglés',      pt: 'Inglês',         de: 'Englisch',     pl: 'Angielski',    it: 'Inglese',    ar: 'إنجليزي',      da: 'Engelsk',    hi: 'अंग्रेज़ी'      },
  },
  {
    code: 'ja',
    label: '日语',
    labelNative: '日本語',
    flag: '🇯🇵',
    ttsPrefix: 'ja',
    translateName: 'Japanese',
    nativeName: '日本語',
    fieldSuffix: 'Ja',
    i18nLabel: { zh: '日文', en: 'Japanese', ja: '日本語',   ko: '일본어',   fr: 'Japonais',  fi: 'japani',      es: 'Japonés',     pt: 'Japonês',        de: 'Japanisch',    pl: 'Japoński',     it: 'Giapponese', ar: 'ياباني',       da: 'Japansk',    hi: 'जापानी'        },
  },
  {
    code: 'ko',
    label: '韩语',
    labelNative: '한국어',
    flag: '🇰🇷',
    ttsPrefix: 'ko',
    translateName: 'Korean',
    nativeName: '한국어',
    fieldSuffix: 'Ko',
    i18nLabel: { zh: '韩文', en: 'Korean',   ja: '韓国語',   ko: '한국어',   fr: 'Coréen',    fi: 'korea',       es: 'Coreano',     pt: 'Coreano',        de: 'Koreanisch',   pl: 'Koreański',    it: 'Coreano',    ar: 'كوري',         da: 'Koreansk',   hi: 'कोरियाई'     },
  },
  {
    code: 'fr',
    label: '法语',
    labelNative: 'Français',
    flag: '🇫🇷',
    ttsPrefix: 'fr',
    translateName: 'French',
    nativeName: 'Français',
    fieldSuffix: 'Fr',
    i18nLabel: { zh: '法文', en: 'French',   ja: 'フランス語', ko: '프랑스어', fr: 'Français',  fi: 'ranska',      es: 'Francés',     pt: 'Francês',        de: 'Französisch',  pl: 'Francuski',    it: 'Francese',   ar: 'فرنسي',        da: 'Fransk',     hi: 'फ़्रेंच'      },
  },
  {
    code: 'fi',
    label: '芬兰语',
    labelNative: 'suomi',
    flag: '🇫🇮',
    ttsPrefix: 'fi',
    translateName: 'Finnish',
    nativeName: 'suomi',
    fieldSuffix: 'Fi',
    i18nLabel: { zh: '芬兰语', en: 'Finnish',   ja: 'フィンランド語', ko: '핀란드어', fr: 'Finnois',     fi: 'suomi',         es: 'Finlandés',    pt: 'Finlandês',      de: 'Finnisch',     pl: 'Fiński',       it: 'Finlandese', ar: 'فنلندي',        da: 'Finsk',      hi: 'फ़िनिश'      },
  },
  {
    code: 'es',
    label: '西班牙语',
    labelNative: 'Español',
    flag: '🇪🇸',
    ttsPrefix: 'es',
    translateName: 'Spanish',
    nativeName: 'Español',
    fieldSuffix: 'Es',
    i18nLabel: { zh: '西班牙语', en: 'Spanish',  ja: 'スペイン語', ko: '스페인어', fr: 'Espagnol',    fi: 'espanja',      es: 'Español',     pt: 'Espanhol',       de: 'Spanisch',     pl: 'Hiszpański',   it: 'Spagnolo',   ar: 'إسباني',        da: 'Spansk',     hi: 'स्पेनिश'     },
  },
  {
    code: 'pt',
    label: '葡萄牙语',
    labelNative: 'Português',
    flag: '🇵🇹',
    ttsPrefix: 'pt',
    translateName: 'Portuguese',
    nativeName: 'Português',
    fieldSuffix: 'Pt',
    i18nLabel: { zh: '葡萄牙语', en: 'Portuguese', ja: 'ポルトガル語', ko: '포르투갈어', fr: 'Portugais',  fi: 'portugali',  es: 'Portugués',   pt: 'Português',      de: 'Portugiesisch', pl: 'Portugalski',  it: 'Portoghese', ar: 'برتغالي',      da: 'Portugisisk', hi: 'पुर्तगाली' },
  },
  {
    code: 'de',
    label: '德语',
    labelNative: 'Deutsch',
    flag: '🇩🇪',
    ttsPrefix: 'de',
    translateName: 'German',
    nativeName: 'Deutsch',
    fieldSuffix: 'De',
    i18nLabel: { zh: '德语', en: 'German',   ja: 'ドイツ語', ko: '독일어',   fr: 'Allemand',   fi: 'saksa',       es: 'Alemán',      pt: 'Alemão',         de: 'Deutsch',      pl: 'Niemiecki',    it: 'Tedesco',    ar: 'ألماني',        da: 'Tysk',       hi: 'जर्मन'       },
  },
  {
    code: 'pl',
    label: '波兰语',
    labelNative: 'Polski',
    flag: '🇵🇱',
    ttsPrefix: 'pl',
    translateName: 'Polish',
    nativeName: 'Polski',
    fieldSuffix: 'Pl',
    i18nLabel: { zh: '波兰语', en: 'Polish',   ja: 'ポーランド語', ko: '폴란드어', fr: 'Polonais',  fi: 'puola',       es: 'Polaco',      pt: 'Polonês',        de: 'Polnisch',     pl: 'Polski',       it: 'Polacco',    ar: 'بولندي',        da: 'Polsk',      hi: 'पोलिश'      },
  },
  {
    code: 'it',
    label: '意大利语',
    labelNative: 'Italiano',
    flag: '🇮🇹',
    ttsPrefix: 'it',
    translateName: 'Italian',
    nativeName: 'Italiano',
    fieldSuffix: 'It',
    i18nLabel: { zh: '意大利语', en: 'Italian', ja: 'イタリア語', ko: '이탈리아어', fr: 'Italien',   fi: 'italia',      es: 'Italiano',    pt: 'Italiano',       de: 'Italienisch',  pl: 'Włoski',       it: 'Italiano',   ar: 'إيطالي',        da: 'Italiensk',  hi: 'इतालवी'     },
  },
  {
    code: 'ar',
    label: '阿拉伯语',
    labelNative: 'العربية',
    flag: '🇸🇦',
    ttsPrefix: 'ar',
    translateName: 'Arabic',
    nativeName: 'العربية',
    fieldSuffix: 'Ar',
    i18nLabel: { zh: '阿拉伯语', en: 'Arabic',  ja: 'アラビア語', ko: '아랍어',   fr: 'Arabe',      fi: 'arabia',      es: 'Árabe',       pt: 'Árabe',          de: 'Arabisch',     pl: 'Arabski',      it: 'Arabo',      ar: 'العربية',       da: 'Arabisk',    hi: 'अरबी'       },
  },
  {
    code: 'da',
    label: '丹麦语',
    labelNative: 'Dansk',
    flag: '🇩🇰',
    ttsPrefix: 'da',
    translateName: 'Danish',
    nativeName: 'Dansk',
    fieldSuffix: 'Da',
    i18nLabel: { zh: '丹麦语', en: 'Danish',   ja: 'デンマーク語', ko: '덴마크어', fr: 'Danois',     fi: 'tanska',      es: 'Danés',       pt: 'Dinamarquês',    de: 'Dänisch',      pl: 'Duński',       it: 'Danese',     ar: 'دنماركي',       da: 'Dansk',      hi: 'डेनिश'      },
  },
  {
    code: 'hi',
    label: '印地语',
    labelNative: 'हिन्दी',
    flag: '🇮🇳',
    ttsPrefix: 'hi',
    translateName: 'Hindi',
    nativeName: 'हिन्दी',
    fieldSuffix: 'Hi',
    i18nLabel: { zh: '印地语', en: 'Hindi',    ja: 'ヒンディー語', ko: '힌두어',  fr: 'Hindi',      fi: 'hindi',       es: 'Hindi',       pt: 'Hindi',          de: 'Hindi',        pl: 'Hindi',        it: 'Hindi',      ar: 'هندي',          da: 'Hindi',      hi: 'हिन्दी',      th: 'ภาษาฮินดี',   ru: 'Хинди',        el: 'Χίντι',        ms: 'Hindi'        },
  },
  {
    code: 'th',
    label: '泰语',
    labelNative: 'ภาษาไทย',
    flag: '🇹🇭',
    ttsPrefix: 'th',
    translateName: 'Thai',
    nativeName: 'ภาษาไทย',
    fieldSuffix: 'Th',
    i18nLabel: { zh: '泰语',   en: 'Thai',     ja: 'タイ語',     ko: '태국어',   fr: 'Thaï',       fi: 'thai',        es: 'Tailandés',   pt: 'Tailandês',      de: 'Thailändisch', pl: 'Tajski',       it: 'Thailandese', ar: 'تايلاندي',      da: 'Thailandsk', hi: 'थाई',          th: 'ภาษาไทย',      ru: 'Тайский',      el: 'Ταϊλανδικά',   ms: 'Thai'         },
  },
  {
    code: 'ru',
    label: '俄语',
    labelNative: 'Русский',
    flag: '🇷🇺',
    ttsPrefix: 'ru',
    translateName: 'Russian',
    nativeName: 'Русский',
    fieldSuffix: 'Ru',
    i18nLabel: { zh: '俄语',   en: 'Russian',  ja: 'ロシア語',   ko: '러시아어', fr: 'Russe',      fi: 'venäjä',      es: 'Ruso',        pt: 'Russo',          de: 'Russisch',     pl: 'Rosyjski',     it: 'Russo',      ar: 'روسي',          da: 'Russisk',    hi: 'रूसी',         th: 'ภาษารัสเซีย',   ru: 'Русский',      el: 'Ρωσικά',       ms: 'Rusia'        },
  },
  {
    code: 'el',
    label: '希腊语',
    labelNative: 'Ελληνικά',
    flag: '🇬🇷',
    ttsPrefix: 'el',
    translateName: 'Greek',
    nativeName: 'Ελληνικά',
    fieldSuffix: 'El',
    i18nLabel: { zh: '希腊语', en: 'Greek',    ja: 'ギリシャ語', ko: '그리스어', fr: 'Grec',       fi: 'kreikka',     es: 'Griego',      pt: 'Grego',          de: 'Griechisch',   pl: 'Grecki',       it: 'Greco',      ar: 'يوناني',        da: 'Græsk',      hi: 'यूनानी',       th: 'ภาษากรีก',       ru: 'Греческий',    el: 'Ελληνικά',     ms: 'Greek'        },
  },
  {
    code: 'ms',
    label: '马来语',
    labelNative: 'Bahasa Melayu',
    flag: '🇲🇾',
    ttsPrefix: 'ms',
    translateName: 'Malay',
    nativeName: 'Bahasa Melayu',
    fieldSuffix: 'Ms',
    i18nLabel: { zh: '马来语', en: 'Malay',    ja: 'マレー語',   ko: '말레이어', fr: 'Malais',     fi: 'malaiji',     es: 'Malayo',      pt: 'Malaio',         de: 'Malaiisch',    pl: 'Malajski',     it: 'Malese',     ar: 'ماليزي',        da: 'Malaysisk',  hi: 'मलय',           th: 'ภาษามาเลย์',    ru: 'Малайский',    el: 'Μαλαϊκά',      ms: 'Bahasa Melayu'},
  },
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

// ── 绘本文字语言偏好（localStorage 持久化） ──
//
// 用户在「语言设置」里勾选要生成的语言，未勾选的语言：
//   1. translate.ts 不会让 LLM 翻译（节省 token + 加快生成）
//   2. BookReader 朗读下拉里不显示
// 至少要勾选 1 种；默认 ['zh', 'en']。
// 注意：这是客户端设置（仅决定是否生成/显示），不影响已存在的 BookItem 数据。

const BOOK_LANGS_KEY = 'wstory_book_langs'
export const DEFAULT_BOOK_LANGS: LangCode[] = ['zh', 'en']

/** 读取绘本文字语言偏好；非法或空值回退到默认 ['zh','en'] */
export function getBookLangs(): LangCode[] {
  if (typeof localStorage === 'undefined') return DEFAULT_BOOK_LANGS
  try {
    const raw = localStorage.getItem(BOOK_LANGS_KEY)
    if (!raw) return DEFAULT_BOOK_LANGS
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return DEFAULT_BOOK_LANGS
    const valid = arr.filter((c): c is LangCode =>
      typeof c === 'string' && c in LANG_BY_CODE
    )
    return valid.length > 0 ? valid : DEFAULT_BOOK_LANGS
  } catch {
    return DEFAULT_BOOK_LANGS
  }
}

/** 写入绘本文字语言偏好（已校验；非空数组才落盘） */
export function setBookLangs(langs: LangCode[]): void {
  if (typeof localStorage === 'undefined') return
  const valid = langs.filter((c): c is LangCode => c in LANG_BY_CODE)
  if (valid.length === 0) return
  localStorage.setItem(BOOK_LANGS_KEY, JSON.stringify(valid))
}
