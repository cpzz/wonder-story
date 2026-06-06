import { useState, useEffect, useRef, useCallback } from 'react'
import type { BookItem, DropdownOptions, Guide, Story, APIKeyView, LLMSettings } from '@/types'
import { PROTAGONIST_PRESET_OPTIONS } from '@/lib/protagonistPresets'
import { LANGUAGES, LANG_BY_CODE, localizedFieldName, pickVoiceForLang, getBookLangs, type LangCode } from '@/lib/languages'
import { useI18n, translateByKey } from '../i18n'
import '../i18n/locales'
import AdminPage from './Admin'
import { isLatinLocale } from '../i18n'

// ── Illustration styles ──

// Style names are resolved via t() at render time; this array provides id→key mapping
export const ILLUSTRATION_STYLES: { id: string; nameKey: string }[] = [
  { id: 'watercolor',   nameKey: 'style.watercolor' },
  { id: 'kawaii',       nameKey: 'style.kawaii' },
  { id: 'flat',         nameKey: 'style.flat' },
  { id: 'cartoon',      nameKey: 'style.cartoon' },
  { id: 'vintage',      nameKey: 'style.vintage' },
  { id: 'chinese',      nameKey: 'style.chinese' },
  { id: 'collage',      nameKey: 'style.collage' },
  { id: 'realistic',    nameKey: 'style.realistic' },
  { id: 'printmaking',  nameKey: 'style.printmaking' },
]

const DEFAULT_STYLE_ID = 'watercolor'

// ── Cover art config ──

const COVER_MAP: Record<string, { colors: [string, string]; emoji: string }> = {
  '害怕': { colors: ['#4f46e5', '#7c3aed'], emoji: '😨' },
  '难过': { colors: ['#3b82f6', '#0369a1'], emoji: '😢' },
  '愤怒': { colors: ['#ef4444', '#f97316'], emoji: '😠' },
  '焦虑': { colors: ['#f59e0b', '#f97316'], emoji: '😰' },
  '孤独': { colors: ['#64748b', '#334155'], emoji: '😔' },
  '委屈': { colors: ['#ec4899', '#f43f5e'], emoji: '😭' },
  '嫉妒': { colors: ['#10b981', '#0d9488'], emoji: '😒' },
  '紧张': { colors: ['#f59e0b', '#d97706'], emoji: '😬' },
}

const BEDTIME_THEME_MAP: Record<string, string> = {
  '动物朋友': '🐰', '太空冒险': '🚀', '海底世界': '🐠', '森林精灵': '🌿', '魔法王国': '✨', '小镇日常': '🏡',
}

function getCover(emotion: string) {
  return COVER_MAP[emotion] ?? { colors: ['#7c3aed', '#6d28d9'] as [string, string], emoji: '📖' }
}

function getBedtimeCover(theme?: string) {
  const emoji = (theme && BEDTIME_THEME_MAP[theme]) ? BEDTIME_THEME_MAP[theme] : '🌙'
  return { colors: ['#1e1b4b', '#312e81'] as [string, string], emoji }
}

// Helper to translate book fields (emotion, scene, theme)
function translateBookField(field: string, type: 'emotion' | 'scene' | 'theme', t: (key: string) => string): string {
  return t(`${type}.${field}`)
}

// ── EditableSelect ──

function EditableSelect({
  value, options, placeholder, onChange, onAdd, onDelete,
  translateKey,
}: {
  value: string; options: string[]; placeholder: string
  onChange: (v: string) => void; onAdd: (v: string) => void; onDelete: (v: string) => void
  translateKey?: 'emotion' | 'scene' | 'theme'
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [newVal, setNewVal] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Helper to translate option values
  const translateOption = (option: string): string => {
    if (!translateKey) return option
    return t(`${translateKey}.${option}`)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white hover:border-purple-300 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>{value ? translateOption(value) : placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-56 flex flex-col">
            <div className="overflow-y-auto">
              {(!options || options.length === 0) ? (
                <p className="text-center text-gray-400 text-xs py-4">{t('create.noOptions')}</p>
              ) : options.map((opt) => (
                <div key={opt} className="flex items-center group hover:bg-gray-50">
                  <button type="button" onClick={() => { onChange(opt); setOpen(false) }}
                    className={`flex-1 text-left px-4 py-2.5 text-sm ${opt === value ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'}`}>
                    {translateOption(opt)}
                  </button>
                  <button type="button" onClick={() => onDelete(opt)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-2 text-red-400 hover:text-red-600 text-sm transition-opacity" title="删除">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 p-2 flex gap-2">
              <input value={newVal} onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newVal.trim()) { onAdd(newVal.trim()); setNewVal('') } }}
                placeholder={t('create.addOption')} onClick={(e) => e.stopPropagation()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300" />
              <button type="button" onClick={() => { if (newVal.trim()) { onAdd(newVal.trim()); setNewVal('') } }}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                {t('create.add')}
              </button>
            </div>
          </div>
      )}
    </div>
  )
}

// ── GuideModal ──

function GuideModal({ book, lang, onClose }: { book: BookItem; lang: LangCode; onClose: () => void }) {
  const { t } = useI18n()
  const isBedtime = book.mode === 'bedtime'
  const cover = isBedtime ? getBedtimeCover(book.theme) : getCover(book.emotion)
  const getText = (v: Record<string, string | undefined>): string => {
    const key = localizedFieldName(lang)
    const candidate = v[key]
    if (candidate?.trim()) return candidate
    return v.text ?? ''
  }
  const getTips = (list: Record<string, string[] | undefined>): string[] => {
    const key = localizedFieldName(lang)
    const candidate = list[key]
    if (Array.isArray(candidate) && candidate.length) return candidate
    return list.text
  }
  const message = getText(book.guide.message)
  const tipsArr = getTips(book.guide.tips)
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-fit max-w-[66vw] min-w-80 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cover.emoji}</span>
            <div>
              <h3 className="font-bold text-gray-800">{t('guide.title')}</h3>
              <p className="text-xs text-gray-400">{t('guide.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-700 leading-relaxed text-sm bg-amber-50 rounded-xl p-4 border border-amber-100">{message}</p>
          <ul className="space-y-2">
            {tipsArr.map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── BookReader ──

type ReaderPage =
  | { type: 'cover' }
  | { type: 'guide' }
  | { type: 'story'; pageNumber: number; text: string; [key: `text${string}`]: string | undefined; imagePrompt?: string }

function BookReader({ book, onDisplayLangChange, uiLocale }: { book: BookItem; onDisplayLangChange?: (lang: LangCode) => void; uiLocale: LangCode }) {
  const { t } = useI18n()
  const isBedtime = book.mode === 'bedtime'
  const cover = isBedtime ? getBedtimeCover(book.theme) : getCover(book.emotion)

  const pages: ReaderPage[] = [
    { type: 'cover' },
    ...[...book.story.pages].sort((a, b) => a.pageNumber - b.pageNumber).map((p) => ({
      type: 'story' as const,
      pageNumber: p.pageNumber,
      text: p.text,
      ...(p as Record<string, string | undefined>),
      imagePrompt: p.imagePrompt,
    })),
  ]
  const total = pages.length
  const storyPageCount = book.story.pages.length

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)  // 跟踪用户是否进行了交互
  const defaultVoiceLang = (uiLang?: string): LangCode => {
    if (uiLang === 'en') return 'en'
    if (uiLocale === 'en') return 'en'
    if (uiLocale === 'zh') return 'zh'
    return 'zh'
  }
  const [voiceLang, setVoiceLang] = useState<LangCode | 'off'>(() => defaultVoiceLang(book.uiLang))
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [guideOpen, setGuideOpen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({})
  const [coverImageFailed, setCoverImageFailed] = useState(false)
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false)
  const voiceMenuRef = useRef<HTMLDivElement>(null)

  // 关闭朗读语言下拉
  useEffect(() => {
    if (!voiceMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(e.target as Node)) {
        setVoiceMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [voiceMenuOpen])

  // Notify parent of active display language
  useEffect(() => {
    if (voiceLang !== 'off') onDisplayLangChange?.(voiceLang)
  }, [voiceLang])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when book changes or UI locale changes
  useEffect(() => {
    setIdx(0); setPlaying(false); speechSynthesis.cancel()
    setVoiceLang(uiLocale === 'en' ? 'en' : 'zh')
    setVoiceEnabled(true)
    setCoverImageFailed(false)
    setHasInteracted(false)
  }, [book.id, uiLocale]) // uiLocale 已是 LangCode；非 en 时落回中文

  // 用户在「语言设置」里取消勾选了当前 voiceLang → 自动回退到首个选中的语言
  useEffect(() => {
    const bookLangs = getBookLangs()
    if (voiceLang !== 'off' && !bookLangs.includes(voiceLang)) {
      setVoiceLang(bookLangs[0] ?? 'zh')
    }
  }, [voiceLang])

  /** 从 LocalizedValue 风格的扁平字段中，按当前 voiceLang 取出文本 */
  const getText = useCallback((fields: Record<string, string | undefined> | undefined): string => {
    if (!fields) return ''
    if (voiceLang === 'off') return fields.text ?? ''
    const key = localizedFieldName(voiceLang)
    if (fields[key]?.trim()) return fields[key] as string
    if (fields.text?.trim()) return fields.text
    return ''
  }, [voiceLang])

  const getSpeakable = useCallback((p: ReaderPage): { text: string; voice: SpeechSynthesisVoice | null } | null => {
    if (!voiceEnabled || voiceLang === 'off') return null
    if (p.type === 'guide') return null  // 引导页不朗读
    // 封面页只有在用户交互后才朗读
    if (p.type === 'cover' && !hasInteracted) return null
    const lang = voiceLang as LangCode
    const getStoredVoice = (code: LangCode) => {
      const all = speechSynthesis.getVoices()
      const stored = localStorage.getItem(`wstory_${code}_voice`)
      return pickVoiceForLang(all, code, stored ?? undefined)
    }
    // 封面页朗读标题
    if (p.type === 'cover') {
      return { text: getText(book.title as Record<string, string | undefined>), voice: getStoredVoice(lang) }
    }
    return { text: getText(p as Record<string, string | undefined>), voice: getStoredVoice(lang) }
  }, [book, voiceLang, voiceEnabled, hasInteracted, getText])

  const speak = useCallback((p: ReaderPage) => {
    speechSynthesis.cancel()
    const s = getSpeakable(p)
    if (!s) return
    const utt = new SpeechSynthesisUtterance(s.text)
    utt.voice = s.voice
    utt.rate = 0.9
    speechSynthesis.speak(utt)
  }, [getSpeakable])

  // Speak current page and (if playing) auto-advance.
  // Re-runs on page change, play/pause toggle, or any voice setting change.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    speechSynthesis.cancel()
    const s = getSpeakable(pages[idx])
    if (playing) {
      if (s) {
        const utt = new SpeechSynthesisUtterance(s.text)
        utt.voice = s.voice
        utt.rate = 0.9
        utt.onend = () => {
          timerRef.current = setTimeout(() => {
            setIdx((i) => { if (i < total - 1) return i + 1; return i })
          }, 1000)
        }
        speechSynthesis.speak(utt)
      } else {
        timerRef.current = setTimeout(() => {
          setIdx((i) => { if (i < total - 1) return i + 1; return i })
        }, 1000)
      }
    } else {
      if (s) {
        const utt = new SpeechSynthesisUtterance(s.text)
        utt.voice = s.voice
        utt.rate = 0.9
        speechSynthesis.speak(utt)
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); speechSynthesis.cancel() }
  }, [playing, idx, getSpeakable])

  const goTo = (i: number) => { 
    speechSynthesis.cancel() 
    setPlaying(false) 
    setIdx(i)
    setHasInteracted(true)  // 用户导航时标记为已交互
  }
  const prev = () => goTo(Math.max(0, idx - 1))
  const next = () => goTo(Math.min(total - 1, idx + 1))

  const cur = pages[idx]

  return (
    <div className="flex flex-col h-full w-full">
      {/* ── Page content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 overflow-y-auto">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center">
        {cur.type === 'cover' && (
          <div className="w-full max-w-xs">
            {/* Cover image (generated) */}
            {!coverImageFailed && (
              <img
                src={`/api/books/${book.id}/images/0`}
                alt={t('reader.coverAlt')}
                className="w-full rounded-3xl shadow-2xl object-cover"
                style={{ aspectRatio: '3/4' }}
                onError={() => setCoverImageFailed(true)}
              />
            )}
            {/* Fallback gradient cover */}
            {coverImageFailed && (
              <div className="rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${cover.colors[0]}, ${cover.colors[1]})`, aspectRatio: '3/4' }}>
                <div className="h-full relative flex flex-col justify-between p-8">
                  <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
                  <div className="absolute -bottom-12 -left-8 w-52 h-52 rounded-full bg-white/10" />
                  <div className="relative">
                    <div className="text-7xl mb-6 drop-shadow-lg">{cover.emoji}</div>
                    <h2 className="text-white font-bold text-2xl leading-snug drop-shadow">
                      {getText(book.title as Record<string, string | undefined>)}
                    </h2>
                  </div>
                  <div className="relative">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(() => {
                        const vl = voiceLang === 'off' ? 'zh' : voiceLang
                        const tags = isBedtime
                          ? [book.theme ? translateByKey(`theme.${book.theme}`, vl) : translateByKey('home.bedtimeStory', vl), translateByKey('common.ageUnit', vl, { age: book.ageGroup })]
                          : [translateByKey(`emotion.${book.emotion}`, vl), translateByKey(`scene.${book.scene}`, vl), translateByKey('common.ageUnit', vl, { age: book.ageGroup })]
                        return tags.map((tag) => (
                          <span key={tag} className="bg-white/20 text-white/90 text-xs px-2.5 py-0.5 rounded-full">{tag}</span>
                        ))
                      })()}
                    </div>
                    <p className="text-white/60 text-xs">{new Date(book.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                </div>
              </div>
            )}
            {/* Title below generated cover image */}
            {!coverImageFailed && (
              <h2 className="text-center font-bold text-gray-800 text-lg mt-3 leading-snug">
                {getText(book.title as Record<string, string | undefined>)}
              </h2>
            )}
          </div>
        )}

        {cur.type === 'guide' && null}

        {cur.type === 'story' && (
          <div className="w-full max-w-lg">
            {/* Image with text overlay */}
            <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ width: '100%', aspectRatio: '1/1' }}>
              <img
                src={`/api/books/${book.id}/images/${cur.pageNumber}`}
                alt={t('reader.pageAlt', { n: cur.pageNumber })}
                className="w-full h-full object-cover"
                onLoad={() => setImageLoaded((prev) => ({ ...prev, [cur.pageNumber]: true }))}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                  if (placeholder) placeholder.style.display = 'flex'
                }}
              />
              {/* Placeholder shown on error */}
              <div className="absolute inset-0 flex-col items-center justify-center hidden"
                style={{ background: `linear-gradient(135deg, ${cover.colors[0]}22, ${cover.colors[1]}44)` }}>
                <span className="text-8xl">{cover.emoji}</span>
              </div>
              {/* Text overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 px-4 py-4"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)' }}>
                <p className="text-white text-lg leading-snug font-medium text-center drop-shadow">
                  {getText(cur as Record<string, string | undefined>)}
                </p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white py-3">
        <div className="w-full flex items-center gap-2 px-4">
          {/* Guide button - leftmost */}
          <button onClick={() => setGuideOpen(true)}
            className="flex-shrink-0 px-2.5 h-9 flex items-center justify-center rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-50 transition-all text-xs font-medium whitespace-nowrap">
            {t('reader.parentNote')}
          </button>

          {/* Page dots */}
          <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden">
            {pages.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={`rounded-full transition-all ${i === idx ? 'w-4 h-2 bg-purple-600' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
            ))}
          </div>

          {/* To start */}
          <button onClick={() => goTo(0)} disabled={idx === 0}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title={t('reader.toStart')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Prev */}
          <button onClick={prev} disabled={idx === 0}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Auto-play toggle */}
          <button onClick={() => { setPlaying((p) => !p); setHasInteracted(true) }}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${playing ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200 text-gray-500 hover:text-purple-600 hover:border-purple-300'}`}
            title={playing ? t('reader.pause') : t('reader.play')}>
            {playing ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button onClick={next} disabled={idx === total - 1}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* To end */}
          <button onClick={() => goTo(total - 1)} disabled={idx === total - 1}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title={t('reader.toEnd')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          </button>

          {/* Voice enable/disable (master mute) */}
          <button onClick={() => setVoiceEnabled((e) => !e)}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${voiceEnabled ? 'bg-green-50 border-green-300 text-green-600' : 'border-gray-200 text-gray-300 hover:text-gray-400'}`}
            title={voiceEnabled ? t('reader.muteOn') : t('reader.muteOff')}>
            {voiceEnabled ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.99 2L21 18.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            )}
          </button>

          {/* 中|英|日|韩|法 朗读语言下拉菜单 */}
          <div ref={voiceMenuRef} className={`flex-shrink-0 relative transition-opacity ${!voiceEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
            <button onClick={() => setVoiceMenuOpen((o) => !o)}
              className="h-9 px-2.5 flex items-center gap-1.5 text-xs font-bold rounded-xl border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors"
              title={t('reader.voiceLang')}>
              <span>
                {voiceLang === 'off'
                  ? `🔇 ${t('reader.voiceOff')}`
                  : LANG_BY_CODE[voiceLang].i18nLabel[uiLocale]}
              </span>
              <svg className={`w-3 h-3 transition-transform ${voiceMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {voiceMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[140px]">
                {LANGUAGES.filter((l) => getBookLangs().includes(l.code)).map((l) => {
                  const active = voiceLang === l.code
                  return (
                    <button key={l.code} type="button"
                      onClick={() => { setVoiceLang(l.code); setVoiceMenuOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${active ? 'bg-purple-50 text-purple-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                      {l.i18nLabel[uiLocale]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Page label */}
          <span className="text-xs text-gray-400 text-right flex-shrink-0" style={{ width: '48px' }}>
            {idx === 0 ? t('reader.cover') : `${idx}/${storyPageCount}`}
          </span>
        </div>
      </div>
      {guideOpen && <GuideModal book={book} lang={uiLocale} onClose={() => setGuideOpen(false)} />}
    </div>
  )
}

// ── CreateModal ──

const DEFAULT_OPTIONS: DropdownOptions = {
  emotions: ['害怕', '难过', '愤怒', '焦虑', '孤独', '委屈', '嫉妒', '紧张', '失望', '羞耻', '无聊', '崩溃', '不安', '伤心', '慌乱'],
  scenes: ['家里', '幼儿园', '学校', '户外', '朋友家', '医院'],
  ageGroups: ['2-3', '3-5', '5-7', '7-10'],
  themes: ['动物朋友', '太空冒险', '海底世界', '森林精灵', '魔法王国', '小镇日常', '恐龙乐园', '云朵王国', '小火车', '四季变换', '彩虹仙境', '夜晚星空', '农场生活', '城市探索', '冰雪世界'],
}

function CreateModal({ open, hidden, onClose, options, onOptionsChange, onCreated, displayLang, locale, onWarning }: {
  open: boolean; hidden?: boolean; onClose: () => void; options: DropdownOptions;
  onOptionsChange: (o: DropdownOptions) => void; onCreated: (b: BookItem) => void;
  displayLang: LangCode; locale: LangCode;
  onWarning?: (title: string, statusCode?: number) => void;
}) {
  const { t } = useI18n()
  const [emotion, setEmotion] = useState('')
  const [scene, setScene] = useState('')
  const [ageGroup, setAgeGroup] = useState('6')
  const [description, setDescription] = useState('')
  const [protagonistPreset, setProtagonistPreset] = useState('protagonist.auto')
  const [mode, setMode] = useState<'emotion' | 'bedtime'>('emotion')
  const [theme, setTheme] = useState('')
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID)
  const textLang: 'bilingual' = 'bilingual' // 始终为双语模式
  const uiLang: 'zh' | 'en' = displayLang === 'en' ? 'en' : 'zh'
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warnPictureLLM, setWarnPictureLLM] = useState(false)

  const persistOptions = (updated: DropdownOptions) => {
    onOptionsChange(updated)
    fetch('/api/options', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
  }

  // Parse API error into a user-friendly message based on HTTP status code
  const parseApiError = async (res: Response): Promise<string> => {
    const latin = isLatinLocale(locale)
    try {
      await res.json()
      const status = res.status

      if (status === 400) return latin ? '400 Request parameter error' : '400 请求参数错误'
      if (status === 401) return latin ? '401 API key is invalid or expired' : '401 API 密钥无效或已过期'
      if (status === 403) return latin ? '403 Insufficient permissions for this model' : '403 没有该模型的访问权限'
      if (status === 404) return latin ? '404 Model or service not found' : '404 模型或服务不存在'
      if (status === 429) return latin ? '429 Too many requests or quota exceeded' : '429 请求过于频繁或配额已用完'
      if (status >= 500) return latin ? '500 Service temporarily unavailable' : '500 服务暂时不可用'
      return latin ? `${status} Service error` : `${status} 服务错误`
    } catch { /* ignore parse errors */ }
    return latin ? 'Service temporarily unavailable' : '服务暂时不可用'
  }
  const handleAdd = (type: keyof DropdownOptions, value: string) => {
    if (options[type].includes(value)) return
    persistOptions({ ...options, [type]: [...options[type], value] })
  }
  const handleDelete = (type: keyof DropdownOptions, value: string) => {
    persistOptions({ ...options, [type]: options[type].filter((v) => v !== value) })
    if (type === 'emotions' && emotion === value) setEmotion('')
    if (type === 'scenes' && scene === value) setScene('')
    if (type === 'ageGroups' && ageGroup === value) setAgeGroup('')
    if (type === 'themes' && theme === value) setTheme('')
  }
  const handleGenerate = async () => {
    if (mode === 'emotion' && (!emotion || !scene || !ageGroup)) { setError(t('create.error.selectFields')); return }
    if (mode === 'bedtime' && !ageGroup) { setError(t('create.error.enterAge')); return }
    // Check LLM configuration first
    const statusRes = await fetch('/api/llm-status')
    const { hasStoryLLM, hasPictureLLM }: { hasStoryLLM: boolean; hasPictureLLM: boolean } = await statusRes.json()
    if (!hasStoryLLM && !hasPictureLLM) {
      setError(t('create.error.configureLlm'))
      return
    }
    if (!hasStoryLLM) {
      setError(t('create.error.configureStoryLlm'))
      return
    }
    setError(null)
    setWarnPictureLLM(!hasPictureLLM)
    setGenerating(true)
    const input = { emotion, scene, ageGroup, description, protagonistPreset, mode, theme, textLang, uiLang }
    try {
      // Guide (background step, no numbered display)
      setGenStep(mode === 'bedtime' ? t('create.step.preparingGuide') : t('create.step.analyzingEmotion'))
      console.log('[generate] 开始生成引导建议')
      const guideRes = await fetch('/api/trouble', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!guideRes.ok) throw new Error(await parseApiError(guideRes))
      let guide: Guide = await guideRes.json()
      console.log('[generate] 引导建议完成')

      // ① 正在构建故事角色... → ② 正在创作专属故事... (timer, same LLM call)
      setGenStep(t('create.step.buildingCharacters'))
      console.log('[generate] ① 正在构建故事角色...')
      const storyStepTimer = setTimeout(() => {
        setGenStep(mode === 'bedtime' ? t('create.step.creatingBedtimeStory') : t('create.step.creatingStory'))
        console.log('[generate] ② 正在创作专属故事...')
      }, 6000)
      const storyRes = await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      clearTimeout(storyStepTimer)
      if (!storyRes.ok) throw new Error(await parseApiError(storyRes))
      const storyData = await storyRes.json()
      let story: Story = storyData.story ?? storyData
      let characters = storyData.characters ?? []
      console.log(`[generate] 故事+角色完成: ${story.pages?.length} 页, ${characters.length} 个角色`)

      // ③ 正在生成故事内容（翻译 + 插画描述）...
      setGenStep(t('create.step.generatingContent'))
      console.log('[generate] ③ 正在生成故事内容 ...')
      const transRes = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ story, guide, characters, textLang, illustrationStyleId: styleId, bookLangs: getBookLangs() }) })
      if (!transRes.ok) throw new Error(await parseApiError(transRes))
      const translated = await transRes.json()
      story = translated.story
      guide = translated.guide
      console.log(
        `[generate] ③ 完成: ${story.pages?.length} 页 imagePrompts, cover imagePrompt=${!!story.cover?.imagePrompt}`,
      )

      // ⑥ 正在保存...
      setGenStep(t('create.step.saving'))
      console.log('[generate] ⑥ 正在保存...')
      const saveBody = { ...input, guide, story, characters, illustrationStyleId: styleId }
      const saveRes = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveBody) })
      if (!saveRes.ok) throw new Error(await parseApiError(saveRes))
      const book: BookItem = await saveRes.json()
      console.log(`[generate] ⑥ 保存完成: bookId=${book.id}`)

      const hasIllustrationPrompts =
        !!(book.story.cover?.imagePrompt?.trim()) || book.story.pages.some((p) => p.imagePrompt?.trim())

      let refsFailed = false
      let pagesFailed = false
      let imageErrorCode = 0

      if (hasPictureLLM && hasIllustrationPrompts) {
        
        // ④ 正在绘制角色定妆图...
        setGenStep(t('create.step.drawingRefs'))
        console.log('[generate] ④ 正在绘制角色定妆图...')
        const refsRes = await fetch('/api/qwen-image/gen-refs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: book.id }),
        }).catch(console.error)
        
        // 检查角色参考图是否有失败
        if (refsRes) {
          try {
            const refsData = await refsRes.json()
            refsFailed = refsData.results?.some((r: { success: boolean }) => !r.success)
            if (refsFailed) {
              const failed = refsData.results?.find((r: { success: boolean; statusCode?: number }) => !r.success)
              imageErrorCode = failed?.statusCode || 0
              console.warn('[generate] 角色参考图生成失败，跳过后续插图生成')
            }
          } catch (e) {
            console.error('[generate] 解析角色参考图结果失败', e)
          }
        }
        
        if (!refsFailed) {
          console.log('[generate] ④ 角色定妆图完成')

          // ⑤ 正在生成绘本插图（第 X/N 页）...  — page by page for live progress
          const sortedPages = [...book.story.pages].sort((a, b) => a.pageNumber - b.pageNumber)
          const pagesToDraw = sortedPages.filter((p) => p.imagePrompt?.trim())
          const hasCover = !!book.story.cover?.imagePrompt
          const totalPages = pagesToDraw.length
          let donePages = 0

          if (hasCover) {
            setGenStep(t('create.step.generatingCover'))
            console.log('[generate] ⑤ 生成封面插图')
            const coverRes = await fetch('/api/qwen-image/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookId: book.id, pageNumbers: [0] }),
            }).catch(console.error)
            
            if (coverRes) {
              try {
                const coverData = await coverRes.json()
                pagesFailed = coverData.results?.some((r: { success: boolean }) => !r.success)
                if (pagesFailed) {
                  const failed = coverData.results?.find((r: { success: boolean; statusCode?: number }) => !r.success)
                  imageErrorCode = failed?.statusCode || 0
                  console.warn('[generate] 封面插图生成失败，跳过后续页面')
                }
              } catch (e) {
                console.error('[generate] 解析封面结果失败', e)
              }
            }
          }

          if (!pagesFailed) {
            for (const page of pagesToDraw) {
              donePages++
              setGenStep(t('create.step.generatingPage', { done: donePages, total: totalPages }))
              console.log(`[generate] ⑤ 生成第 ${page.pageNumber} 页插图 (${donePages}/${totalPages})`)
              const pageRes = await fetch('/api/qwen-image/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookId: book.id, pageNumbers: [page.pageNumber] }),
              }).catch(console.error)
              
              if (pageRes) {
                try {
                  const pageData = await pageRes.json()
                  pagesFailed = pageData.results?.some((r: { success: boolean }) => !r.success)
                  if (pagesFailed) {
                    const failed = pageData.results?.find((r: { success: boolean; statusCode?: number }) => !r.success)
                    imageErrorCode = failed?.statusCode || 0
                    console.warn(`[generate] 第 ${page.pageNumber} 页插图生成失败，跳过后续页面`)
                    break
                  }
                } catch (e) {
                  console.error('[generate] 解析页面结果失败', e)
                }
              }
            }
          }
          
          if (pagesFailed) {
            console.warn('[generate] 插图生成过程中出现失败')
          } else {
            console.log('[generate] ⑤ 所有插图生成完成')
          }
        }
      }

      const hadImageFailure = refsFailed || pagesFailed

      // 绘本文本已生成，加入列表；如果有图片失败，同时通知用户
      onCreated(book); onClose()
      if (hadImageFailure) {
        setTimeout(() => onWarning?.(t('create.warning.imageGenerationFailed'), imageErrorCode), 200)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('create.error.generateFailed'))
    } finally { setGenerating(false); setGenStep('') }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ visibility: hidden ? 'hidden' : 'visible', transition: 'visibility 0s' }}>
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '520px' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-800 text-lg">{t('create.title')}</h3>
          {!generating && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
          )}
        </div>
        {/* Mode tabs */}
        {!generating && (
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button onClick={() => { setMode('emotion'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'emotion' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
              😢 {t('create.emotionMode')}
            </button>
            <button onClick={() => { setMode('bedtime'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'bedtime' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              🌙 {t('create.bedtimeMode')}
            </button>
          </div>
        )}
        {generating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="inline-block w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 text-sm">{genStep}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="text-base flex-shrink-0">❌</span>
              <span>{error}</span>
            </div>}

            {/* Emotion mode */}
            {mode === 'emotion' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.ageLabel')} <span className="text-red-400">*</span></label>
                  <input type="number" min={2} max={14} value={ageGroup}
                    onChange={(e) => { setAgeGroup(e.target.value); localStorage.setItem('wstory_age_group', e.target.value) }} placeholder="2-14"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.emotionLabel')} <span className="text-red-400">*</span></label>
                  <EditableSelect value={emotion} options={options.emotions} placeholder={t('create.emotionPlaceholder')} onChange={setEmotion}
                    onAdd={(v) => handleAdd('emotions', v)} onDelete={(v) => handleDelete('emotions', v)}
                    translateKey="emotion" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.sceneLabel')} <span className="text-red-400">*</span></label>
                  <EditableSelect value={scene} options={options.scenes} placeholder={t('create.scenePlaceholder')} onChange={setScene}
                    onAdd={(v) => handleAdd('scenes', v)} onDelete={(v) => handleDelete('scenes', v)}
                    translateKey="scene" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.styleLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                  <select value={styleId} onChange={(e) => { setStyleId(e.target.value); localStorage.setItem('wstory_style_id', e.target.value) }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                    {ILLUSTRATION_STYLES.map((s) => <option key={s.id} value={s.id}>{t(s.nameKey)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.protagonistLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                <select
                  value={protagonistPreset}
                  onChange={(e) => {
                    const v = e.target.value
                    setProtagonistPreset(v)
                    localStorage.setItem('wstory_protagonist_preset', v)
                  }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                >
                  {PROTAGONIST_PRESET_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{t(opt)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.descLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('create.descPlaceholder')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={3} />
              </div>
            </>)}

            {/* Bedtime mode */}
            {mode === 'bedtime' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.ageLabel')} <span className="text-red-400">*</span></label>
                  <input type="number" min={2} max={14} value={ageGroup}
                    onChange={(e) => { setAgeGroup(e.target.value); localStorage.setItem('wstory_age_group', e.target.value) }} placeholder="2-14"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.themeLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                  <EditableSelect value={theme} options={options.themes} placeholder={t('create.themePlaceholder')} onChange={setTheme}
                    onAdd={(v) => handleAdd('themes', v)} onDelete={(v) => handleDelete('themes', v)}
                    translateKey="theme" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.styleLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                <select value={styleId} onChange={(e) => { setStyleId(e.target.value); localStorage.setItem('wstory_style_id', e.target.value) }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  {ILLUSTRATION_STYLES.map((s) => <option key={s.id} value={s.id}>{t(s.nameKey)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.protagonistLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                <select
                  value={protagonistPreset}
                  onChange={(e) => {
                    const v = e.target.value
                    setProtagonistPreset(v)
                    localStorage.setItem('wstory_protagonist_preset', v)
                  }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {PROTAGONIST_PRESET_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{t(opt)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('create.extraLabel')}<span className="ml-1 text-xs text-gray-400 font-normal">{t('create.styleOptional')}</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('create.extraPlaceholder')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={3} />
              </div>
            </>)}


            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('create.cancel')}</button>
              <button onClick={handleGenerate}
                disabled={mode === 'emotion' ? (!emotion || !scene || !ageGroup) : !ageGroup}
                className={`flex-1 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors ${mode === 'bedtime' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {t('create.start')}
              </button>
            </div>
          </div>
        )}

        {/* Inline warning for missing picture LLM */}
        {warnPictureLLM && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <span className="text-base flex-shrink-0">⚠️</span>
            <span>{t('create.warning.noPictureLlm')}</span>
          </div>
        )}

      </div>
    </div>
  )
}

// ── HomePage ──

export default function HomePage() {
  const { t, locale, setLocale } = useI18n()
  const [books, setBooks] = useState<BookItem[]>([])
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createHidden, setCreateHidden] = useState(false)
  const [createModalKey, setCreateModalKey] = useState(0)
  const [warning, setWarning] = useState<string | null>(null)
  const [warningDetail, setWarningDetail] = useState<string>('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')
  const [deleteTargetName, setDeleteTargetName] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminBootstrap, setAdminBootstrap] = useState<{ keys: APIKeyView[]; llm: LLMSettings } | null>(null)
  const [adminBootstrapKey, setAdminBootstrapKey] = useState(0)
  const [adminPrefetching, setAdminPrefetching] = useState(false)
  const [displayLang, setDisplayLang] = useState<LangCode>('zh')
  const [options, setOptions] = useState<DropdownOptions>(DEFAULT_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [uiLangMenuOpen, setUiLangMenuOpen] = useState(false)
  const uiLangMenuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭 UI 语言下拉
  useEffect(() => {
    if (!uiLangMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (uiLangMenuRef.current && !uiLangMenuRef.current.contains(e.target as Node)) {
        setUiLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [uiLangMenuOpen])

  useEffect(() => {
    fetch('/api/books').then((r) => (r.ok ? r.json() : [])).then((data: BookItem[]) => {
      setBooks(data)
      if (data.length > 0) setSelectedBook(data[0])
      setLoading(false)
    })
    fetch('/api/options').then((r) => (r.ok ? r.json() : {})).then((data: Partial<DropdownOptions>) => {
      setOptions({
        emotions: data.emotions ?? DEFAULT_OPTIONS.emotions,
        scenes: data.scenes ?? DEFAULT_OPTIONS.scenes,
        ageGroups: data.ageGroups ?? DEFAULT_OPTIONS.ageGroups,
        themes: data.themes ?? DEFAULT_OPTIONS.themes,
      })
    })
  }, [])

  const openAdminSettings = async () => {
    if (adminPrefetching) return
    setAdminPrefetching(true)
    try {
      const [kRes, lRes] = await Promise.all([fetch('/api/admin/api-keys'), fetch('/api/admin/llm-settings')])
      const keyList: APIKeyView[] = kRes.ok ? await kRes.json() : []
      const llmRaw: LLMSettings | null = lRes.ok ? await lRes.json() : null
      const llm: LLMSettings =
        llmRaw && llmRaw.storyLLMId !== undefined
          ? { storyLLMId: llmRaw.storyLLMId, pictureLLMId: llmRaw.pictureLLMId ?? '' }
          : { storyLLMId: '', pictureLLMId: '' }
      setAdminBootstrapKey((k) => k + 1)
      setAdminBootstrap({ keys: keyList.map((k) => ({ ...k })), llm })
      setAdminOpen(true)
    } catch {
      setAdminBootstrapKey((k) => k + 1)
      setAdminBootstrap({ keys: [], llm: { storyLLMId: '', pictureLLMId: '' } })
      setAdminOpen(true)
    } finally {
      setAdminPrefetching(false)
    }
  }

  const closeAdminSettings = () => {
    setAdminOpen(false)
    setAdminBootstrap(null)
  }

  const handleCreated = (book: BookItem) => { setBooks((prev) => [book, ...prev]); setSelectedBook(book) }

  const openCreateModal = () => {
    setCreateModalKey((k) => k + 1)
    setCreateOpen(true)
  }

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTargetId(id)
    setDeleteTargetName(name)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false)
    const id = deleteTargetId
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== id)
        if (selectedBook?.id === id) setSelectedBook(next[0] ?? null)
        return next
      })
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-800">{t('home.appTitle')}</h1>
            <div className="flex items-center gap-1">
              <div className="relative" ref={uiLangMenuRef}>
                <button
                  type="button"
                  onClick={() => setUiLangMenuOpen((o) => !o)}
                  className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xs font-bold"
                  title={t('home.uiLang')}
                >
                  <span>{LANG_BY_CODE[locale].labelNative}</span>
                  <svg className={`w-3 h-3 transition-transform ${uiLangMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {uiLangMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[140px]">
                    {LANGUAGES.map((l) => {
                      const active = locale === l.code
                      return (
                        <button key={l.code} type="button"
                          onClick={() => { setLocale(l.code); setUiLangMenuOpen(false) }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${active ? 'bg-purple-50 text-purple-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                          {l.labelNative}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { void openAdminSettings() }}
                disabled={adminPrefetching}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                title={t('home.settings')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
          <button onClick={openCreateModal}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t('home.createNew')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-10 px-5">
              <div className="text-3xl mb-3">📚</div>
              <p className="text-gray-400 text-sm">{t('home.noBooks')}</p>
              <p className="text-gray-400 text-xs mt-1">{t('home.noBooksHint')}</p>
            </div>
          ) : books.map((book) => {
            const c = book.mode === 'bedtime' ? getBedtimeCover(book.theme) : getCover(book.emotion)
            const isSelected = selectedBook?.id === book.id
            const styleKey =
              ILLUSTRATION_STYLES.find((s) => s.id === (book.illustrationStyleId ?? 'watercolor'))?.nameKey ?? 'style.watercolor'
            const styleName = t(styleKey)
            const dateLabel = new Date(book.createdAt).toLocaleDateString('zh-CN')
            const metaLine1 =
              book.mode === 'bedtime'
                ? `🌙 ${book.theme ? translateBookField(book.theme, 'theme', t) : t('home.bedtimeStory')} · ${styleName}`
                : `💛 ${translateBookField(book.emotion, 'emotion', t)} · ${styleName}`
            return (
              <div key={book.id} onClick={() => setSelectedBook(book)}
                className={`mx-2 my-0.5 px-3 py-3 rounded-xl cursor-pointer group flex items-center gap-3 transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                <div className="w-10 h-12 rounded-lg flex-shrink-0 overflow-hidden shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]})` }}>
                  {book.id ? (
                    <img
                      src={`/api/books/${book.id}/images/0`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const fb = e.currentTarget.nextElementSibling as HTMLElement
                        if (fb) fb.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full items-center justify-center text-lg hidden" style={{ display: book.id ? 'none' : 'flex' }}>
                    {c.emoji}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const titleKey = localizedFieldName(locale)
                    const localizedTitle = (book.title as Record<string, string | undefined>)[titleKey]
                    const displayTitle = localizedTitle?.trim() ? localizedTitle : book.title.text
                    return (<>
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>{displayTitle}</p>
                      </div>
                      <p className={`text-xs mt-0.5 truncate ${isSelected ? 'text-purple-600/80' : 'text-gray-400'}`}>{metaLine1}</p>
                      <p className={`text-xs pl-4 mt-0.5 ${isSelected ? 'text-purple-600/70' : 'text-gray-400'}`}>{t('common.ageUnit', { age: book.ageGroup })} · {dateLabel}</p>
                    </>)
                  })()}
                </div>
                <button onClick={(e) => handleDelete(book.id, book.title?.text ?? book.id, e)}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 text-gray-300 hover:text-red-500 flex items-center justify-center rounded transition-all text-lg leading-none" title="删除">
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </aside>
      <main className="flex-1 flex overflow-hidden">
        {!selectedBook ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📖</div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">{t('home.appTitle')}</h2>
              <p className="text-gray-400 text-sm mb-6">{t('home.subtitle')}</p>
              <button onClick={openCreateModal} className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
                {t('home.createFirst')}
              </button>
            </div>
          </div>
        ) : (
          <BookReader book={selectedBook} onDisplayLangChange={setDisplayLang} uiLocale={locale} />
        )}
      </main>
      {createOpen && (
        <CreateModal
          key={createModalKey}
          open={createOpen}
          hidden={createHidden}
          onClose={() => { setCreateOpen(false); setCreateHidden(false) }}
          options={options}
          onOptionsChange={setOptions}
          onCreated={handleCreated}
          displayLang={locale === 'en' ? 'en' : 'zh'}
          locale={locale}
          onWarning={(title, statusCode) => {
            setCreateHidden(true)
            setWarning(title)
            const code = typeof statusCode === 'number' ? statusCode : 0
            const latin = isLatinLocale(locale)
            if (code === 400) setWarningDetail(latin ? '400 Request parameter error' : '400 请求参数错误')
            else if (code === 401) setWarningDetail(latin ? '401 API key is invalid or expired' : '401 API 密钥无效或已过期')
            else if (code === 403) setWarningDetail(latin ? '403 Insufficient permissions for this model' : '403 没有该模型的访问权限')
            else if (code === 404) setWarningDetail(latin ? '404 Model or service not found' : '404 模型或服务不存在')
            else if (code === 429) setWarningDetail(latin ? '429 Too many requests or quota exceeded' : '429 请求过于频繁或配额已用完')
            else if (code >= 500) setWarningDetail(latin ? '500 Service temporarily unavailable' : '500 服务暂时不可用')
            else setWarningDetail(latin ? 'Unknown error' : '未知错误')
          }}
        />
      )}

      {/* Warning notification overlay */}
      {warning && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setWarning(null); setCreateOpen(false); setCreateHidden(false) }} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0 mt-0.5">⚠️</span>
              <div>
                <h4 className="text-base font-bold text-gray-800">
                {isLatinLocale(locale) ? 'Notice: ' : '提示：'}{warning.replace(/^⚠️\s*/, '')}
              </h4>
                {warningDetail && (
                  <p className="text-gray-500 text-sm mt-1">{warningDetail}</p>
                )}
                {!warningDetail && (
                  <p className="text-gray-500 text-sm mt-1">{t('create.warning.imageFailedHint')}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => { setWarning(null); setCreateOpen(false); setCreateHidden(false) }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors text-sm">
                {isLatinLocale(locale) ? 'OK' : '知道了'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteConfirmOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🗑️</span>
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-2">
                {isLatinLocale(locale) ? 'Delete Picture Book?' : '确认删除绘本？'}
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {isLatinLocale(locale)
                  ? `"${deleteTargetName}" will be permanently deleted. This action cannot be undone.`
                  : `绘本"${deleteTargetName}"将被永久删除，此操作无法撤销。`}
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  {isLatinLocale(locale) ? 'Cancel' : '取消'}
                </button>
                <button onClick={confirmDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                  {isLatinLocale(locale) ? 'Delete' : '删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {adminOpen && adminBootstrap && (
        <AdminPage
          key={adminBootstrapKey}
          open={adminOpen}
          initialKeys={adminBootstrap.keys}
          initialLlm={adminBootstrap.llm}
          onClose={closeAdminSettings}
        />
      )}
    </div>
  )
}
