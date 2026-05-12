import { useState, useEffect } from 'react'
import type { BookItem, DropdownOptions, Guide, Story, PictureBook } from '@/types'

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

function getCover(emotion: string) {
  return COVER_MAP[emotion] ?? { colors: ['#7c3aed', '#6d28d9'] as [string, string], emoji: '📖' }
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

// ── BookCover ──

function BookCover({ book, onRead }: { book: BookItem; onRead: () => void }) {
  const [hovered, setHovered] = useState(false)
  const cover = getCover(book.emotion)
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer select-none"
      style={{ background: `linear-gradient(135deg, ${cover.colors[0]}, ${cover.colors[1]})`, aspectRatio: '3 / 4', width: '100%', maxWidth: '320px' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-14 -left-10 w-56 h-56 rounded-full bg-white/10" />
      <div className="relative h-full flex flex-col justify-between p-7">
        <div>
          <div className="text-6xl mb-5 drop-shadow-lg">{cover.emoji}</div>
          <h2 className="text-white font-bold text-xl leading-snug drop-shadow">{book.title}</h2>
        </div>
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[book.emotion, book.scene, `${book.ageGroup}岁`].map((tag) => (
              <span key={tag} className="bg-white/20 text-white/90 text-xs px-2.5 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
          <p className="text-white/60 text-xs">{new Date(book.createdAt).toLocaleDateString('zh-CN')}</p>
        </div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${hovered ? 'bg-black/25 opacity-100' : 'opacity-0'}`}>
        <button onClick={onRead} className="bg-white text-purple-700 font-bold px-10 py-3 rounded-full shadow-xl text-base hover:scale-105 transition-transform">
          阅读
        </button>
      </div>
    </div>
  )
}

// ── CreateModal ──

const DEFAULT_OPTIONS: DropdownOptions = {
  emotions: ['害怕', '难过', '愤怒', '焦虑', '孤独', '委屈', '嫉妒', '紧张'],
  scenes: ['家里', '幼儿园', '学校', '户外', '朋友家', '医院'],
  ageGroups: ['2-3', '3-5', '5-7', '7-10'],
}

function CreateModal({ open, onClose, options, onOptionsChange, onCreated }: {
  open: boolean; onClose: () => void; options: DropdownOptions
  onOptionsChange: (o: DropdownOptions) => void; onCreated: (book: BookItem) => void
}) {
  const [emotion, setEmotion] = useState('')
  const [scene, setScene] = useState('')
  const [ageGroup, setAgeGroup] = useState('6')
  const [description, setDescription] = useState('')
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
  }
  const handleGenerate = async () => {
    if (!emotion || !scene || !ageGroup) { setError('请选择情绪、场景和年龄段'); return }
    setError(null); setGenerating(true)
    const input = { emotion, scene, ageGroup, description }
    try {
      setGenStep('正在分析情绪...')
      const guideRes = await fetch('/api/trouble', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!guideRes.ok) throw new Error((await guideRes.json()).error)
      const guide: Guide = await guideRes.json()

      setGenStep('正在创作专属故事...')
      const storyRes = await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!storyRes.ok) throw new Error((await storyRes.json()).error)
      const story: Story = await storyRes.json()

      setGenStep('正在生成绘本插画描述...')
      const pbRes = await fetch('/api/picture-book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ story, ageGroup }) })
      if (!pbRes.ok) throw new Error((await pbRes.json()).error)
      const pictureBook: PictureBook = await pbRes.json()

      setGenStep('正在保存...')
      const saveRes = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, guide, story, pictureBook }) })
      if (!saveRes.ok) throw new Error((await saveRes.json()).error)
      const book: BookItem = await saveRes.json()

      onCreated(book); onClose()
      setEmotion(''); setScene(''); setAgeGroup(''); setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally { setGenerating(false); setGenStep('') }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">创作新绘本</h3>
          {!generating && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
          )}
        </div>
        {generating ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-block w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 text-sm">{genStep}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
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
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">孩子年龄(岁) <span className="text-red-400">*</span></label>
              <input
                type="number" min={2} max={14}
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="请输入年龄（2-14）"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">具体描述<span className="ml-1 text-xs text-gray-400 font-normal">（可选）</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="描述孩子的具体情况，帮助生成更贴心的故事..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={3} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">取消</button>
              <button onClick={handleGenerate} disabled={!emotion || !scene || !ageGroup}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
                开始创作
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ReadingModal ──

function ReadingModal({ book, onClose }: { book: BookItem; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const pages = book.pictureBook.pages
  const totalPages = pages.length
  const cover = getCover(book.emotion)
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${cover.colors[0]}, ${cover.colors[1]})` }}>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{book.title}</h2>
            <p className="text-white/70 text-xs mt-0.5">{page === 0 ? '家长引导' : `第 ${page} / ${totalPages} 页`}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {page === 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
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
          ) : (() => {
            const p = pages[page - 1]
            return (
              <div className="space-y-5">
                <div className="w-full rounded-xl flex items-center justify-center py-12"
                  style={{ background: `linear-gradient(135deg, ${cover.colors[0]}22, ${cover.colors[1]}44)` }}>
                  <span className="text-7xl">{cover.emoji}</span>
                </div>
                <p className="text-gray-800 text-lg leading-relaxed font-medium text-center px-4">{p.text}</p>
                {p.imagePrompt && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium mb-1">🎨 插画提示词</p>
                    <p className="text-xs text-gray-500 italic leading-relaxed">{p.imagePrompt}</p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="text-sm font-medium text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors">
            ← 上一页
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages + 1 }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === page ? 'bg-purple-600' : 'bg-gray-200 hover:bg-gray-300'}`} />
            ))}
          </div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="text-sm font-medium text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors">
            下一页 →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── HomePage ──

export default function HomePage() {
  const [books, setBooks] = useState<BookItem[]>([])
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null)
  const [readingBook, setReadingBook] = useState<BookItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
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
            <a href="/admin" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="系统设置">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>
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
            const c = getCover(book.emotion)
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
                  <p className="text-xs text-gray-400 mt-0.5">{book.emotion} · {new Date(book.createdAt).toLocaleDateString('zh-CN')}</p>
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
      <main className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        {!selectedBook ? (
          <div className="text-center">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">童心事·绘本</h2>
            <p className="text-gray-400 text-sm mb-6">用一个故事，陪孩子走过每一种情绪</p>
            <button onClick={() => setCreateOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
              创作第一本绘本
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 max-w-xs w-full">
            <BookCover book={selectedBook} onRead={() => setReadingBook(selectedBook)} />
            <div className="text-center">
              <h2 className="font-bold text-gray-800 text-lg">{selectedBook.title}</h2>
              <p className="text-gray-500 text-sm mt-1">{selectedBook.emotion} · {selectedBook.scene} · {selectedBook.ageGroup}岁</p>
              <p className="text-gray-400 text-xs mt-1">共 {selectedBook.pictureBook.pages.length} 页</p>
            </div>
          </div>
        )}
      </main>
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} options={options} onOptionsChange={setOptions} onCreated={handleCreated} />
      {readingBook && <ReadingModal book={readingBook} onClose={() => setReadingBook(null)} />}
    </div>
  )
}
