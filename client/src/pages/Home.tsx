import { useState, useEffect, useRef, useCallback } from 'react'
import type { BookItem, DropdownOptions, Guide, Story, PictureBook, APIKeyView, LLMSettings } from '@/types'
import { PROTAGONIST_PRESET_OPTIONS } from '@/lib/protagonistPresets'
import AdminPage from './Admin'

// ── Illustration styles ──

export const ILLUSTRATION_STYLES: { id: string; name: string }[] = [
  { id: 'watercolor',   name: '清新水彩' },
  { id: 'kawaii',       name: '可爱治愈' },
  { id: 'flat',         name: '简约扁平' },
  { id: 'cartoon',      name: '卡通夸张' },
  { id: 'vintage',      name: '复古经典' },
  { id: 'chinese',      name: '国风水墨' },
  { id: 'collage',      name: '拼贴手工' },
  { id: 'realistic',    name: '写实细腻' },
  { id: 'printmaking',  name: '版画装饰' },
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

// ── EditableSelect ──

function EditableSelect({
  value, options, placeholder, onChange, onAdd, onDelete,
}: {
  value: string; options: string[]; placeholder: string
  onChange: (v: string) => void; onAdd: (v: string) => void; onDelete: (v: string) => void
}) {
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

  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white hover:border-purple-300 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>{value || placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-56 flex flex-col">
            <div className="overflow-y-auto">
              {(!options || options.length === 0) ? (
                <p className="text-center text-gray-400 text-xs py-4">暂无选项</p>
              ) : options.map((opt) => (
                <div key={opt} className="flex items-center group hover:bg-gray-50">
                  <button type="button" onClick={() => { onChange(opt); setOpen(false) }}
                    className={`flex-1 text-left px-4 py-2.5 text-sm ${opt === value ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'}`}>
                    {opt}
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
                placeholder="新增选项..." onClick={(e) => e.stopPropagation()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300" />
              <button type="button" onClick={() => { if (newVal.trim()) { onAdd(newVal.trim()); setNewVal('') } }}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                添加
              </button>
            </div>
          </div>
      )}
    </div>
  )
}

// ── GuideModal ──

function GuideModal({ book, lang, onClose }: { book: BookItem; lang: 'zh' | 'en'; onClose: () => void }) {
  const isBedtime = book.mode === 'bedtime'
  const cover = isBedtime ? getBedtimeCover(book.theme) : getCover(book.emotion)
  const useEn = lang === 'en'
  const message = useEn && book.guide.message.textEn ? book.guide.message.textEn : book.guide.message.text
  const tipsArr = useEn && book.guide.tips.textEn?.length ? book.guide.tips.textEn : book.guide.tips.text
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-fit max-w-[66vw] min-w-80 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cover.emoji}</span>
            <div>
              <h3 className="font-bold text-gray-800">{useEn ? 'A Note for Parents' : '给家长的话'}</h3>
              <p className="text-xs text-gray-400">{useEn ? "Understanding your child's emotions" : '理解孩子的情绪'}</p>
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
  | { type: 'story'; pageNumber: number; text: string; textEn?: string; imagePrompt?: string }

function BookReader({ book, onDisplayLangChange }: { book: BookItem; onDisplayLangChange?: (lang: 'zh' | 'en') => void }) {
  const isBedtime = book.mode === 'bedtime'
  const cover = isBedtime ? getBedtimeCover(book.theme) : getCover(book.emotion)

  const pages: ReaderPage[] = [
    { type: 'cover' },
    ...(book.pictureBook
      ? [...book.pictureBook.pages].sort((a, b) => a.pageNumber - b.pageNumber).map((p) => ({ type: 'story' as const, pageNumber: p.pageNumber, text: p.text, textEn: p.textEn, imagePrompt: p.imagePrompt }))
      : [...book.story.pages].sort((a, b) => a.pageNumber - b.pageNumber).map((p) => ({ type: 'story' as const, pageNumber: p.pageNumber, text: p.text, textEn: p.textEn }))),
  ]
  const total = pages.length

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const defaultVoiceLang = (tl?: string): 'zh' | 'en' | 'off' => tl === 'en' ? 'en' : 'zh'
  const [voiceLang, setVoiceLang] = useState<'zh' | 'en' | 'off'>(() => defaultVoiceLang(book.textLang))
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [guideOpen, setGuideOpen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({})
  const [coverImageFailed, setCoverImageFailed] = useState(false)

  // Notify parent of active display language
  useEffect(() => {
    if (voiceLang === 'zh' || voiceLang === 'en') onDisplayLangChange?.(voiceLang)
  }, [voiceLang])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when book changes
  useEffect(() => {
    setIdx(0); setPlaying(false); speechSynthesis.cancel()
    setVoiceLang(defaultVoiceLang(book.textLang))
    setVoiceEnabled(true)
    setCoverImageFailed(false)
  }, [book.id])

  const getSpeakable = useCallback((p: ReaderPage): { text: string; voice: SpeechSynthesisVoice | null } | null => {
    if (!voiceEnabled || voiceLang === 'off') return null
    if (p.type === 'cover') return null  // 封面不朗读
    const getStoredVoice = (lang: 'zh' | 'en') => {
      const all = speechSynthesis.getVoices()
      const name = localStorage.getItem(lang === 'zh' ? 'wstory_zh_voice' : 'wstory_en_voice')
      if (name) return all.find((v) => v.name === name) ?? all.find((v) => v.lang.startsWith(lang)) ?? null
      return all.find((v) => v.lang.startsWith(lang)) ?? null
    }
    if (voiceLang === 'en') {
      return { text: p.textEn ?? p.text ?? '', voice: getStoredVoice('en') }
    }
    return { text: p.text, voice: getStoredVoice('zh') }
  }, [book, voiceLang, voiceEnabled])

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
        }, 6000)
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

  const goTo = (i: number) => { speechSynthesis.cancel(); setPlaying(false); setIdx(i) }
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
                alt="封面插画"
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
                      {voiceLang === 'en' && book.title.textEn ? book.title.textEn : book.title.text}
                    </h2>
                  </div>
                  <div className="relative">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(isBedtime
                        ? [book.theme || '睡前故事', `${book.ageGroup}岁`]
                        : [book.emotion, book.scene, `${book.ageGroup}岁`]
                      ).map((tag) => (
                        <span key={tag} className="bg-white/20 text-white/90 text-xs px-2.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                    <p className="text-white/60 text-xs">{new Date(book.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                </div>
              </div>
            )}
            {/* Title below generated cover image */}
            {!coverImageFailed && (
              <h2 className="text-center font-bold text-gray-800 text-lg mt-3 leading-snug">
                {voiceLang === 'en' && book.title.textEn ? book.title.textEn : book.title.text}
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
                alt={`第${cur.pageNumber}页插画`}
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
                {(() => {
                  const displayText = voiceLang === 'en' && cur.textEn ? cur.textEn : cur.text
                  return <p className="text-white text-lg leading-snug font-medium text-center drop-shadow">{displayText}</p>
                })()}
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
            💛 给家长的话
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
            title="回到开始">
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
          <button onClick={() => setPlaying((p) => !p)}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${playing ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200 text-gray-500 hover:text-purple-600 hover:border-purple-300'}`}
            title={playing ? '暂停' : '自动播放'}>
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
            title="跳到结尾">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          </button>

          {/* Voice enable/disable (master mute) */}
          <button onClick={() => setVoiceEnabled((e) => !e)}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${voiceEnabled ? 'bg-green-50 border-green-300 text-green-600' : 'border-gray-200 text-gray-300 hover:text-gray-400'}`}
            title={voiceEnabled ? '关闭朗读' : '开启朗读'}>
            {voiceEnabled ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.99 2L21 18.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            )}
          </button>

          {/* 中|英 segmented language selector */}
          <div className={`flex-shrink-0 flex border border-gray-200 rounded-xl overflow-hidden transition-opacity ${!voiceEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
            <button onClick={() => setVoiceLang('zh')}
              className={`px-2.5 h-9 text-xs font-bold transition-colors ${voiceLang === 'zh' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>中</button>
            <div className="w-px bg-gray-200" />
            <button onClick={() => setVoiceLang('en')}
              className={`px-2.5 h-9 text-xs font-bold transition-colors ${voiceLang === 'en' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>英</button>
          </div>

          {/* Page label */}
          <span className="text-xs text-gray-400 text-right flex-shrink-0" style={{ width: '48px' }}>
            {idx === 0 ? '封面' : `${idx}/${total - 1}`}
          </span>
        </div>
      </div>
      {guideOpen && <GuideModal book={book} lang={voiceLang === 'en' ? 'en' : 'zh'} onClose={() => setGuideOpen(false)} />}
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

function CreateModal({ open, onClose, options, onOptionsChange, onCreated }: {
  open: boolean; onClose: () => void; options: DropdownOptions
  onOptionsChange: (o: DropdownOptions) => void; onCreated: (book: BookItem) => void
}) {
  const [emotion, setEmotion] = useState('')
  const [scene, setScene] = useState('')
  const [ageGroup, setAgeGroup] = useState('6')
  const [description, setDescription] = useState('')
  const [protagonistPreset, setProtagonistPreset] = useState('自动')
  const [mode, setMode] = useState<'emotion' | 'bedtime'>('emotion')
  const [theme, setTheme] = useState('')
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID)
  const textLang: 'zh' | 'en' | 'bilingual' = 'bilingual'
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState('')
  const [error, setError] = useState<string | null>(null)

  const persistOptions = (updated: DropdownOptions) => {
    onOptionsChange(updated)
    fetch('/api/options', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
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
    if (mode === 'emotion' && (!emotion || !scene || !ageGroup)) { setError('请选择情绪、场景和年龄段'); return }
    if (mode === 'bedtime' && !ageGroup) { setError('请输入孩子年龄'); return }
    // Check LLM configuration first
    const statusRes = await fetch('/api/llm-status')
    const { hasStoryLLM, hasPictureLLM }: { hasStoryLLM: boolean; hasPictureLLM: boolean } = await statusRes.json()
    if (!hasStoryLLM && !hasPictureLLM) {
      setError('请先在管理后台配置故事和绘本 LLM')
      return
    }
    if (!hasStoryLLM) {
      setError('请先在管理后台配置故事 LLM')
      return
    }
    setError(null); setGenerating(true)
    const input = { emotion, scene, ageGroup, description, protagonistPreset, mode, theme, textLang }
    try {
      // Guide (background step, no numbered display)
      setGenStep(mode === 'bedtime' ? '准备睡前小贴士...' : '正在分析情绪...')
      console.log('[generate] 开始生成引导建议')
      const guideRes = await fetch('/api/trouble', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!guideRes.ok) throw new Error((await guideRes.json()).error)
      let guide: Guide = await guideRes.json()
      console.log('[generate] 引导建议完成')

      // ① 正在构建故事角色... → ② 正在创作专属故事... (timer, same LLM call)
      setGenStep('正在构建故事角色...')
      console.log('[generate] ① 正在构建故事角色...')
      const storyStepTimer = setTimeout(() => {
        setGenStep(mode === 'bedtime' ? '正在创作睡前故事...' : '正在创作专属故事...')
        console.log('[generate] ② 正在创作专属故事...')
      }, 6000)
      const storyRes = await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      clearTimeout(storyStepTimer)
      if (!storyRes.ok) throw new Error((await storyRes.json()).error)
      const storyData = await storyRes.json()
      let story: Story = storyData.story ?? storyData
      let characters = storyData.characters ?? []
      console.log(`[generate] 故事+角色完成: ${story.pages?.length} 页, ${characters.length} 个角色`)

      // ③ 正在生成故事内容（翻译 + 插画描述）...
      setGenStep('正在生成故事内容 ...')
      console.log('[generate] ③ 正在生成故事内容 ...')
      const transRes = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ story, guide, characters, textLang, illustrationStyleId: styleId }) })
      if (!transRes.ok) throw new Error((await transRes.json()).error)
      const translated = await transRes.json()
      story = translated.story
      guide = translated.guide
      let pictureBook: PictureBook | undefined = translated.pictureBook
      console.log(`[generate] ③ 完成: ${pictureBook?.pages?.length} 页 imagePrompts, coverPrompt=${!!pictureBook?.coverPrompt}`)

      // ⑥ 正在保存...
      setGenStep('正在保存...')
      console.log('[generate] ⑥ 正在保存...')
      const saveBody = { ...input, guide, story, characters, illustrationStyleId: styleId, ...(pictureBook ? { pictureBook } : {}) }
      const saveRes = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveBody) })
      if (!saveRes.ok) throw new Error((await saveRes.json()).error)
      const book: BookItem = await saveRes.json()
      console.log(`[generate] ⑥ 保存完成: bookId=${book.id}`)

      if (hasPictureLLM && book.pictureBook) {
        // ④ 正在绘制角色定妆图...
        setGenStep('正在绘制角色定妆图...')
        console.log('[generate] ④ 正在绘制角色定妆图...')
        await fetch('/api/qwen-image/gen-refs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: book.id }),
        }).catch(console.error)
        console.log('[generate] ④ 角色定妆图完成')

        // ⑤ 正在生成绘本插图（第 X/N 页）...  — page by page for live progress
        const sortedPages = [...book.pictureBook.pages].sort((a, b) => a.pageNumber - b.pageNumber)
        const hasCover = !!book.pictureBook.coverPrompt
        const totalPages = sortedPages.length
        let donePages = 0

        if (hasCover) {
          setGenStep('正在生成封面插图...')
          console.log('[generate] ⑤ 生成封面插图')
          await fetch('/api/qwen-image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookId: book.id, pageNumbers: [0] }),
          }).catch(console.error)
        }

        for (const page of sortedPages) {
          donePages++
          setGenStep(`正在生成绘本插图（第 ${donePages}/${totalPages} 页）...`)
          console.log(`[generate] ⑤ 生成第 ${page.pageNumber} 页插图 (${donePages}/${totalPages})`)
          await fetch('/api/qwen-image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookId: book.id, pageNumbers: [page.pageNumber] }),
          }).catch(console.error)
        }
        console.log('[generate] ⑤ 所有插图生成完成')
      }

      onCreated(book); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally { setGenerating(false); setGenStep('') }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '520px' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-800 text-lg">创作新绘本</h3>
          {!generating && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
          )}
        </div>
        {/* Mode tabs */}
        {!generating && (
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button onClick={() => { setMode('emotion'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'emotion' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
              😢 情绪故事
            </button>
            <button onClick={() => { setMode('bedtime'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'bedtime' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              🌙 睡前故事
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
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Emotion mode */}
            {mode === 'emotion' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">孩子年龄(岁) <span className="text-red-400">*</span></label>
                  <input type="number" min={2} max={14} value={ageGroup}
                    onChange={(e) => { setAgeGroup(e.target.value); localStorage.setItem('wstory_age_group', e.target.value) }} placeholder="2-14"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">孩子的情绪 <span className="text-red-400">*</span></label>
                  <EditableSelect value={emotion} options={options.emotions} placeholder="选择情绪..." onChange={setEmotion}
                    onAdd={(v) => handleAdd('emotions', v)} onDelete={(v) => handleDelete('emotions', v)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">发生场景 <span className="text-red-400">*</span></label>
                  <EditableSelect value={scene} options={options.scenes} placeholder="选择场景..." onChange={setScene}
                    onAdd={(v) => handleAdd('scenes', v)} onDelete={(v) => handleDelete('scenes', v)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">插画风格<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
                  <select value={styleId} onChange={(e) => { setStyleId(e.target.value); localStorage.setItem('wstory_style_id', e.target.value) }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                    {ILLUSTRATION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">主角选择<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
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
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">具体描述<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述孩子的具体情况，帮助生成更贴心的故事..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={3} />
              </div>
            </>)}

            {/* Bedtime mode */}
            {mode === 'bedtime' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">孩子年龄(岁) <span className="text-red-400">*</span></label>
                  <input type="number" min={2} max={14} value={ageGroup}
                    onChange={(e) => { setAgeGroup(e.target.value); localStorage.setItem('wstory_age_group', e.target.value) }} placeholder="2-14"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">故事主题<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
                  <EditableSelect value={theme} options={options.themes} placeholder="选择或输入主题..." onChange={setTheme}
                    onAdd={(v) => handleAdd('themes', v)} onDelete={(v) => handleDelete('themes', v)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">插画风格<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
                <select value={styleId} onChange={(e) => { setStyleId(e.target.value); localStorage.setItem('wstory_style_id', e.target.value) }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  {ILLUSTRATION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">主角选择<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
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
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">额外想法<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="孩子喜欢的角色、特别的元素…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={3} />
              </div>
            </>)}


            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">取消</button>
              <button onClick={handleGenerate}
                disabled={mode === 'emotion' ? (!emotion || !scene || !ageGroup) : !ageGroup}
                className={`flex-1 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors ${mode === 'bedtime' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                开始创作
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── HomePage ──

export default function HomePage() {
  const [books, setBooks] = useState<BookItem[]>([])
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createModalKey, setCreateModalKey] = useState(0)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminBootstrap, setAdminBootstrap] = useState<{ keys: APIKeyView[]; llm: LLMSettings } | null>(null)
  const [adminBootstrapKey, setAdminBootstrapKey] = useState(0)
  const [adminPrefetching, setAdminPrefetching] = useState(false)
  const [displayLang, setDisplayLang] = useState<'zh' | 'en'>('zh')
  const [options, setOptions] = useState<DropdownOptions>(DEFAULT_OPTIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/books').then((r) => (r.ok ? r.json() : [])).then((data: BookItem[]) => {
      setBooks(data)
      if (data.length > 0) setSelectedBook(data[0])
      setLoading(false)
    })
    fetch('/api/options').then((r) => (r.ok ? r.json() : {})).then((data) => {
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确认删除这本绘本？')) return
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
            <h1 className="font-bold text-gray-800">童心事·绘本</h1>
            <button
              type="button"
              onClick={() => { void openAdminSettings() }}
              disabled={adminPrefetching}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              title="系统设置"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <button onClick={openCreateModal}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            创作新绘本
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
              <p className="text-gray-400 text-sm">还没有绘本</p>
              <p className="text-gray-400 text-xs mt-1">点击上方按钮创作第一本</p>
            </div>
          ) : books.map((book) => {
            const c = book.mode === 'bedtime' ? getBedtimeCover(book.theme) : getCover(book.emotion)
            const isSelected = selectedBook?.id === book.id
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
                    const displayTitle = displayLang === 'en' && book.title.textEn
                      ? book.title.textEn
                      : book.title.text
                    return (<>
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>{displayTitle}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{book.mode === 'bedtime' ? `🌙 ${book.theme || '睡前故事'}` : `💛 ${book.emotion}`} · {book.ageGroup}岁 · {ILLUSTRATION_STYLES.find((s) => s.id === (book.illustrationStyleId ?? 'watercolor'))?.name ?? '清新水彩'} · {new Date(book.createdAt).toLocaleDateString('zh-CN')}</p>
                    </>)
                  })()}
                </div>
                <button onClick={(e) => handleDelete(book.id, e)}
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
              <h2 className="text-xl font-bold text-gray-700 mb-2">童心事·绘本</h2>
              <p className="text-gray-400 text-sm mb-6">用一个故事，陪孩子走过每一种情绪</p>
              <button onClick={openCreateModal} className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
                创作第一本绘本
              </button>
            </div>
          </div>
        ) : (
          <BookReader book={selectedBook} onDisplayLangChange={setDisplayLang} />
        )}
      </main>
      {createOpen && (
        <CreateModal
          key={createModalKey}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          options={options}
          onOptionsChange={setOptions}
          onCreated={handleCreated}
        />
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
