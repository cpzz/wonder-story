import { useState, useEffect, useRef, useCallback } from 'react'
import type { BookItem, DropdownOptions, Guide, Story, PictureBook } from '@/types'
import AdminPage from './Admin'

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
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white hover:border-purple-300 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>{value || placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-56 flex flex-col">
            <div className="overflow-y-auto">
              {options.map((opt) => (
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
              {options.length === 0 && <p className="text-center text-gray-400 text-xs py-4">暂无选项</p>}
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
        </>
      )}
    </div>
  )
}

// ── BookReader ──

type ReaderPage =
  | { type: 'cover' }
  | { type: 'guide' }
  | { type: 'story'; pageNumber: number; text: string; textEn?: string; imagePrompt?: string }

function BookReader({ book }: { book: BookItem }) {
  const isBedtime = book.mode === 'bedtime'
  const cover = isBedtime ? getBedtimeCover(book.theme) : getCover(book.emotion)

  const pages: ReaderPage[] = [
    { type: 'cover' },
    { type: 'guide' },
    ...(book.pictureBook
      ? book.pictureBook.pages.map((p) => ({ type: 'story' as const, pageNumber: p.pageNumber, text: p.text, textEn: p.textEn, imagePrompt: p.imagePrompt }))
      : book.story.pages.map((p) => ({ type: 'story' as const, pageNumber: p.pageNumber, text: p.text, textEn: p.textEn }))),
  ]
  const total = pages.length

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceIdx, setVoiceIdx] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when book changes
  useEffect(() => { setIdx(0); setPlaying(false); speechSynthesis.cancel() }, [book.id])

  // Load TTS voices filtered by book language
  useEffect(() => {
    const load = () => {
      const all = speechSynthesis.getVoices()
      const textLang = book.textLang ?? 'zh'
      if (textLang === 'en') {
        const en = all.filter((v) => v.lang.startsWith('en'))
        setVoices(en.length ? en : all)
      } else if (textLang === 'bilingual') {
        const zhEn = all.filter((v) => v.lang.startsWith('zh') || v.lang.startsWith('en'))
        setVoices(zhEn.length ? zhEn : all)
      } else {
        const zh = all.filter((v) => v.lang.startsWith('zh'))
        setVoices(zh.length ? zh : all)
      }
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [book.id, book.textLang])

  const pageText = useCallback((p: ReaderPage): string => {
    if (p.type === 'cover') return book.title
    if (p.type === 'guide') return book.guide.message + ' ' + book.guide.tips.join('。')
    // For bilingual books, pick language matching the selected voice
    if (book.textLang === 'bilingual' && p.type === 'story' && p.textEn) {
      const voiceLang = voices[voiceIdx]?.lang ?? ''
      return voiceLang.startsWith('en') ? p.textEn : p.text
    }
    return p.text
  }, [book, voices, voiceIdx])

  const speak = useCallback((p: ReaderPage) => {
    speechSynthesis.cancel()
    if (!voices.length) return
    const utt = new SpeechSynthesisUtterance(pageText(p))
    utt.voice = voices[voiceIdx] ?? null
    utt.rate = 0.9
    speechSynthesis.speak(utt)
  }, [voices, voiceIdx, pageText])

  // Auto-play: speak current page, wait for it to finish, then wait 1s and advance
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    speechSynthesis.cancel()
    if (!playing) return

    if (voices.length && voiceEnabled) {
      const utt = new SpeechSynthesisUtterance(pageText(pages[idx]))
      utt.voice = voices[voiceIdx] ?? null
      utt.rate = 0.9
      utt.onend = () => {
        timerRef.current = setTimeout(() => {
          setIdx((i) => {
            if (i < total - 1) return i + 1
            setPlaying(false)
            return i
          })
        }, 1000)
      }
      speechSynthesis.speak(utt)
    } else {
      // No voices: fall back to fixed 4s delay
      timerRef.current = setTimeout(() => {
        setIdx((i) => {
          if (i < total - 1) return i + 1
          setPlaying(false)
          return i
        })
      }, 4000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      speechSynthesis.cancel()
    }
  }, [playing, idx])

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
            <div className="rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${cover.colors[0]}, ${cover.colors[1]})`, aspectRatio: '3/4' }}>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" style={{ position: 'relative' }} />
              <div className="h-full relative flex flex-col justify-between p-8">
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
                <div className="absolute -bottom-12 -left-8 w-52 h-52 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="text-7xl mb-6 drop-shadow-lg">{cover.emoji}</div>
                  <h2 className="text-white font-bold text-2xl leading-snug drop-shadow">{book.title}</h2>
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
          </div>
        )}

        {cur.type === 'guide' && (
          <div className="w-full max-w-lg space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{cover.emoji}</span>
              <div>
                <h3 className="font-bold text-gray-800">给家长的话</h3>
                <p className="text-xs text-gray-400">理解孩子的情绪</p>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed text-sm bg-amber-50 rounded-xl p-4 border border-amber-100">{book.guide.message}</p>
            <ul className="space-y-2">
              {book.guide.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {cur.type === 'story' && (
          <div className="w-full max-w-lg space-y-5">
            <div className="w-full rounded-2xl flex items-center justify-center py-14"
              style={{ background: `linear-gradient(135deg, ${cover.colors[0]}22, ${cover.colors[1]}44)` }}>
              <span className="text-8xl">{cover.emoji}</span>
            </div>
            {book.textLang === 'bilingual' && cur.textEn ? (
              <div className="space-y-3 px-2 text-center">
                <p className="text-gray-800 text-xl leading-relaxed font-medium">{cur.text}</p>
                <div className="border-t border-gray-100" />
                <p className="text-gray-500 text-base leading-relaxed italic">{cur.textEn}</p>
              </div>
            ) : (
              <p className="text-gray-800 text-xl leading-relaxed font-medium text-center px-2">{cur.text}</p>
            )}
            {cur.imagePrompt && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">🎨 插画提示词</p>
                <p className="text-xs text-gray-500 italic leading-relaxed">{cur.imagePrompt}</p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white py-3">
        <div className="w-full flex items-center gap-3 px-6">
        {/* Prev */}
        {/* Page dots */}
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden">
          {pages.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`rounded-full transition-all ${i === idx ? 'w-4 h-2 bg-purple-600' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
          ))}
        </div>

        {/* Prev */}
        <button onClick={prev} disabled={idx === 0}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Auto-play toggle */}
        <button onClick={() => setPlaying((p) => !p)}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${playing ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200 text-gray-500 hover:text-purple-600 hover:border-purple-300'}`}
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
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Voice toggle + selector */}
        <div className="relative flex items-center">
          <button
            onClick={() => { setVoiceEnabled((e) => !e); setVoiceOpen(false) }}
            className={`w-9 h-9 flex items-center justify-center rounded-l-xl border transition-all ${
              voiceEnabled
                ? 'bg-purple-50 border-purple-300 text-purple-600'
                : 'border-gray-200 text-gray-300 hover:text-gray-400'
            }`}
            title={voiceEnabled ? '关闭语音' : '开启语音'}>
            {voiceEnabled ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M19.07 4.929a9 9 0 010 14.142" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
          <button
            onClick={() => voiceEnabled && setVoiceOpen((o) => !o)}
            disabled={!voiceEnabled}
            className={`w-5 h-9 flex items-center justify-center rounded-r-xl border-t border-r border-b transition-all ${
              voiceEnabled
                ? 'border-purple-300 text-purple-400 hover:bg-purple-50'
                : 'border-gray-200 text-gray-200 cursor-not-allowed'
            }`}
            title="选择语音">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          {voiceOpen && voiceEnabled && voices.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVoiceOpen(false)} />
              <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 min-w-48 max-h-56 overflow-y-auto">
                <p className="text-xs text-gray-400 font-medium px-3 pt-2 pb-1">选择语音</p>
                {voices.map((v, i) => (
                  <button key={v.name} onClick={() => { setVoiceIdx(i); setVoiceOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${i === voiceIdx ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'}`}>
                    {v.name}
                    <span className="ml-1 text-gray-400">{v.lang}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {voiceOpen && voiceEnabled && voices.length === 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVoiceOpen(false)} />
              <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                浏览器暂无可用语音
              </div>
            </>
          )}
        </div>

        {/* Page label */}
        <span className="text-xs text-gray-400 text-right" style={{ width: '48px', flexShrink: 0 }}>
          {idx === 0 ? '封面' : idx === 1 ? '引导' : `${idx - 1}/${total - 2}`}
        </span>
        </div>
      </div>
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
  const [mode, setMode] = useState<'emotion' | 'bedtime'>('emotion')
  const [theme, setTheme] = useState('')
  const [textLang, setTextLang] = useState<'zh' | 'en' | 'bilingual'>('zh')
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmResolve, setConfirmResolve] = useState<null | { fn: (v: boolean) => void }>(null)

  const showConfirm = (): Promise<boolean> =>
    new Promise((resolve) => setConfirmResolve({ fn: resolve }))

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
    let storyOnly = false
    if (!hasPictureLLM) {
      const confirmed = await showConfirm()
      if (!confirmed) return
      storyOnly = true
    }
    setError(null); setGenerating(true)
    const input = { emotion, scene, ageGroup, description, mode, theme, textLang }
    try {
      setGenStep(mode === 'bedtime' ? '准备睡前小贴士...' : '正在分析情绪...')
      const guideRes = await fetch('/api/trouble', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!guideRes.ok) throw new Error((await guideRes.json()).error)
      const guide: Guide = await guideRes.json()

      setGenStep(mode === 'bedtime' ? '正在创作睡前故事...' : '正在创作专属故事...')
      const storyRes = await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!storyRes.ok) throw new Error((await storyRes.json()).error)
      const story: Story = await storyRes.json()

      let pictureBook: PictureBook | undefined
      if (!storyOnly) {
        setGenStep('正在生成绘本插画描述...')
        const pbRes = await fetch('/api/picture-book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ story, ageGroup }) })
        if (!pbRes.ok) throw new Error((await pbRes.json()).error)
        pictureBook = await pbRes.json()
      }

      setGenStep('正在保存...')
      const saveBody = { ...input, guide, story, ...(pictureBook ? { pictureBook } : {}) }
      const saveRes = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveBody) })
      if (!saveRes.ok) throw new Error((await saveRes.json()).error)
      const book: BookItem = await saveRes.json()

      onCreated(book); onClose()
      setEmotion(''); setScene(''); setAgeGroup(''); setDescription(''); setTheme(''); setTextLang('zh')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally { setGenerating(false); setGenStep('') }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">创作新绘本</h3>
          {!generating && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
          )}
        </div>
        {/* Mode tabs */}
        {!generating && (
          <div className="flex border-b border-gray-100">
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
          <div className="px-6 py-16 text-center">
            <div className="inline-block w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 text-sm">{genStep}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Age — always first */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">孩子年龄(岁) <span className="text-red-400">*</span></label>
              <input type="number" min={2} max={14} value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)} placeholder="请输入年龄（2-14）"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>

            {mode === 'emotion' && (<>
              {/* Emotion + Scene side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">孩子的情绪 <span className="text-red-400">*</span></label>
                  <EditableSelect value={emotion} options={options.emotions} placeholder="选择情绪..." onChange={setEmotion}
                    onAdd={(v) => handleAdd('emotions', v)} onDelete={(v) => handleDelete('emotions', v)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">发生场景 <span className="text-red-400">*</span></label>
                  <EditableSelect value={scene} options={options.scenes} placeholder="选择场景..." onChange={setScene}
                    onAdd={(v) => handleAdd('scenes', v)} onDelete={(v) => handleDelete('scenes', v)} />
                </div>
              </div>
            </>)}

            {mode === 'bedtime' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">故事主题<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
                <EditableSelect value={theme} options={options.themes} placeholder="选择或输入主题..." onChange={setTheme}
                  onAdd={(v) => handleAdd('themes', v)} onDelete={(v) => handleDelete('themes', v)} />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {mode === 'bedtime' ? '额外想法' : '具体描述'}
                <span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={mode === 'bedtime' ? '孩子喜欢的角色、特别的元素…' : '描述孩子的具体情况，帮助生成更贴心的故事...'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={3} />
            </div>

            {/* Language selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">故事语言</label>
              <div className="flex gap-2">
                {([['zh', '中文'], ['en', 'English'], ['bilingual', '双语']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setTextLang(val)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      textLang === val
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

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
        {confirmResolve && (
          <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-6 px-8 z-10">
            <p className="text-gray-700 text-center text-sm leading-relaxed font-medium">
              绘本 LLM 未配置<br />是否只生成故事文本内容？
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => { confirmResolve.fn(false); setConfirmResolve(null) }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                取消
              </button>
              <button
                onClick={() => { confirmResolve.fn(true); setConfirmResolve(null) }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                只生成故事
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
  const [adminOpen, setAdminOpen] = useState(false)
  const [options, setOptions] = useState<DropdownOptions>(DEFAULT_OPTIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/books').then((r) => (r.ok ? r.json() : [])).then((data: BookItem[]) => {
      setBooks(data)
      if (data.length > 0) setSelectedBook(data[0])
      setLoading(false)
    })
    fetch('/api/options').then((r) => (r.ok ? r.json() : DEFAULT_OPTIONS)).then(setOptions)
  }, [])

  const handleCreated = (book: BookItem) => { setBooks((prev) => [book, ...prev]); setSelectedBook(book) }

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
            <button onClick={() => setAdminOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="系统设置">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <button onClick={() => setCreateOpen(true)}
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
                <div className="w-10 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-lg shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]})` }}>
                  {c.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>{book.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{book.mode === 'bedtime' ? `🌙 ${book.theme || '睡前故事'}` : `💛 ${book.emotion}`} · {book.ageGroup}岁 · {book.story.pages.length}页 · {new Date(book.createdAt).toLocaleDateString('zh-CN')}</p>
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
              <button onClick={() => setCreateOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
                创作第一本绘本
              </button>
            </div>
          </div>
        ) : (
          <BookReader book={selectedBook} />
        )}
      </main>
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} options={options} onOptionsChange={setOptions} onCreated={handleCreated} />
      {adminOpen && <AdminPage onClose={() => setAdminOpen(false)} />}
    </div>
  )
}
