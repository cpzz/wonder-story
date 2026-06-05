import { useState, useEffect, useRef } from 'react'
import type { APIKeyView, LLMSettings } from '@/types'
import { LANGUAGES, LANG_BY_CODE, pickVoiceForLang, getBookLangs, setBookLangs, type LangCode } from '@/lib/languages'
import { useI18n } from '../i18n'
import '../i18n/locales'

type LocalKeyRow = APIKeyView & { pendingApiKey?: string }

function isDraftKeyId(id: string): boolean {
  return id.startsWith('new_')
}

function keysSnapshot(rows: LocalKeyRow[]): string {
  return JSON.stringify(
    [...rows]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((k) => ({
        id: k.id,
        name: k.name,
        provider: k.provider,
        model: k.model,
        baseURL: k.baseURL ?? '',
        supportsImageGen: k.supportsImageGen,
        pendingSecret: Boolean(k.pendingApiKey),
      })),
  )
}

type Message = { type: 'success' | 'error'; text: string }

interface APIKeyFormData {
  name: string; provider: string; model: string
  baseURL: string; apiKey: string; supportsImageGen: boolean
}
const EMPTY_FORM: APIKeyFormData = { name: '', provider: '', model: '', baseURL: '', apiKey: '', supportsImageGen: false }

const PROVIDER_PRESETS = [
  { labelKey: 'admin.provider.custom', provider: '', model: '', baseURL: '' },
  { labelKey: 'admin.provider.openai', provider: 'openai', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
  { labelKey: 'admin.provider.anthropic', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', baseURL: 'https://api.anthropic.com/v1' },
  { labelKey: 'admin.provider.deepseek', provider: 'deepseek', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
  { labelKey: 'admin.provider.alibaba', provider: 'alibaba', model: 'qwen-max', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { labelKey: 'admin.provider.baidu', provider: 'baidu', model: 'ernie-4.0-8k', baseURL: 'https://qianfan.baidubce.com/v2' },
  { labelKey: 'admin.provider.zhipu', provider: 'zhipu', model: 'glm-4-flash', baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
  { labelKey: 'admin.provider.moonshot', provider: 'moonshot', model: 'moonshot-v1-8k', baseURL: 'https://api.moonshot.cn/v1' },
  { labelKey: 'admin.provider.bytedance', provider: 'bytedance', model: 'doubao-pro-4k', baseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
  { labelKey: 'admin.provider.cmecloud', provider: 'cmecloud', model: '', baseURL: 'https://zhenze-huhehaote.cmecloud.cn/v1' },
]

export default function AdminPage({
  open,
  onClose,
  initialKeys,
  initialLlm,
}: {
  open: boolean
  onClose: () => void
  initialKeys: APIKeyView[]
  initialLlm: LLMSettings
}) {
  const { t, locale, setLocale } = useI18n()
  const [message, setMessage] = useState<Message | null>(null)
  const [adminTab, setAdminTab] = useState<'llm' | 'tts'>('llm')

  // ── API Keys ──
  const [keys, setKeys] = useState<LocalKeyRow[]>(() => initialKeys.map((k) => ({ ...k })))
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<LocalKeyRow | null>(null)
  const [form, setForm] = useState<APIKeyFormData>(EMPTY_FORM)

  // ── LLM Settings ──
  const [llm, setLlm] = useState<LLMSettings>(() => ({
    storyLLMId: initialLlm.storyLLMId,
    pictureLLMId: initialLlm.pictureLLMId ?? '',
  }))
  const [llmSaving, setLlmSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const baselineRef = useRef<{ llm: LLMSettings; keysSig: string; bookLangs: LangCode[]; voicesSig: string }>({
    llm: {
      storyLLMId: initialLlm.storyLLMId,
      pictureLLMId: initialLlm.pictureLLMId ?? '',
    },
    keysSig: keysSnapshot(initialKeys.map((k) => ({ ...k }))),
    bookLangs: getBookLangs(),
    voicesSig: JSON.stringify(
      (() => {
        const out: Record<LangCode, string> = {} as Record<LangCode, string>
        for (const l of LANGUAGES) out[l.code] = localStorage.getItem(`wstory_${l.code}_voice`) ?? ''
        return out
      })()
    ),
  })

  // ── TTS Voices ──
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([])
  // 每个 LangCode 都有独立的 localStorage 键：wstory_<code>_voice
  const [selectedVoices, setSelectedVoices] = useState<Record<LangCode, string>>(() => {
    const out = {} as Record<LangCode, string>
    for (const l of LANGUAGES) {
      out[l.code] = localStorage.getItem(`wstory_${l.code}_voice`) ?? ''
    }
    return out
  })

  // ── 绘本文字语言偏好（多选） ──
  // 持久化在 wstory_book_langs；至少 1 项；默认 ['zh','en']
  const [bookLangs, setBookLangsState] = useState<LangCode[]>(() => getBookLangs())
  const toggleBookLang = (code: LangCode) => {
    setBookLangsState((prev) => {
      const has = prev.includes(code)
      if (has) {
        // 至少保留 1 项
        if (prev.length <= 1) return prev
        return prev.filter((c) => c !== code)
      }
      return [...prev, code]
    })
  }

  const setVoiceFor = (code: LangCode, name: string) => {
    setSelectedVoices((prev) => ({ ...prev, [code]: name }))
  }

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  // bookLangs / voices 变更 → 仅设 dirty，不直接写 localStorage
  const voicesSigNow = () => JSON.stringify(selectedVoices)
  useEffect(() => {
    if (!open) return
    const b = baselineRef.current
    const llmDirty = llm.storyLLMId !== b.llm.storyLLMId || llm.pictureLLMId !== b.llm.pictureLLMId
    const keysDirty = keysSnapshot(keys) !== b.keysSig
    const bookLangsDirty = JSON.stringify(bookLangs) !== JSON.stringify(b.bookLangs)
    const voicesDirty = voicesSigNow() !== b.voicesSig
    setDirty(llmDirty || keysDirty || bookLangsDirty || voicesDirty)
  }, [open, keys, llm, bookLangs, selectedVoices])

  useEffect(() => {
    const load = () => setAllVoices(speechSynthesis.getVoices())
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // 去掉旧的 bookLangs 自动保存 useEffect

  // ── API Key handlers ──
  const openAddKey = () => { setEditingKey(null); setForm(EMPTY_FORM); setKeyModalOpen(true) }
  const openEditKey = (k: LocalKeyRow) => { setEditingKey(k); setForm({ name: k.name, provider: k.provider ?? '', model: k.model ?? '', baseURL: k.baseURL ?? '', apiKey: '', supportsImageGen: k.supportsImageGen }); setKeyModalOpen(true) }
  const closeKeyModal = () => { setKeyModalOpen(false); setEditingKey(null); setForm(EMPTY_FORM) }
  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { showMsg('error', t('admin.keyNameRequired')); return }
    if (!editingKey) {
      const id = `new_${crypto.randomUUID()}`
      const now = new Date().toISOString()
      const secret = form.apiKey.trim()
      const row: LocalKeyRow = {
        id,
        name: form.name.trim(),
        provider: form.provider.trim(),
        model: form.model.trim(),
        baseURL: form.baseURL.trim() || undefined,
        keyMasked: secret ? t('admin.keyPending') : t('admin.keyEmpty'),
        supportsImageGen: form.supportsImageGen,
        createdAt: now,
        updatedAt: now,
      }
      if (secret) row.pendingApiKey = secret
      setKeys((prev) => [...prev, row])
      closeKeyModal()
      return
    }
    setKeys((prev) => prev.map((row) => {
      if (row.id !== editingKey.id) return row
      const next: LocalKeyRow = {
        ...row,
        name: form.name.trim(),
        provider: form.provider.trim(),
        model: form.model.trim(),
        baseURL: form.baseURL.trim() || undefined,
        supportsImageGen: form.supportsImageGen,
        updatedAt: new Date().toISOString(),
      }
      if (form.apiKey.trim()) {
        next.pendingApiKey = form.apiKey.trim()
        next.keyMasked = t('admin.keyPending')
      } else if (!isDraftKeyId(row.id)) {
        delete next.pendingApiKey
      }
      return next
    }))
    closeKeyModal()
  }
  const handleDeleteKey = (id: string) => {
    if (!confirm(t('admin.confirmDeleteKey'))) return
    setKeys((prev) => prev.filter((k) => k.id !== id))
    setLlm((prev) => ({
      storyLLMId: prev.storyLLMId === id ? '' : prev.storyLLMId,
      pictureLLMId: prev.pictureLLMId === id ? '' : prev.pictureLLMId,
    }))
  }

  // ── LLM Settings handlers ──
  const handlePersistConfig = async () => {
    setLlmSaving(true)
    try {
      const apiKeys = keys.map((k) => {
        const row: {
          rowId: string
          name: string
          provider: string
          model: string
          baseURL?: string
          supportsImageGen: boolean
          apiKey?: string
        } = {
          rowId: k.id,
          name: k.name,
          provider: k.provider ?? '',
          model: k.model ?? '',
          baseURL: k.baseURL,
          supportsImageGen: k.supportsImageGen,
        }
        if (k.pendingApiKey?.trim()) row.apiKey = k.pendingApiKey.trim()
        return row
      })
      const res = await fetch('/api/admin/config/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmSettings: llm, apiKeys }),
      })
      let errMsg = t('admin.saveFail')
      if (!res.ok) {
        try {
          const j = await res.json()
          if (typeof j.error === 'string') errMsg = j.error
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }
      if (baselineRef.current) {
        baselineRef.current = {
          llm: { ...llm },
          keysSig: keysSnapshot(keys),
          bookLangs: [...bookLangs],
          voicesSig: JSON.stringify(selectedVoices),
        }
        // 保存 bookLangs 和 voice 选择到 localStorage
        setBookLangs(bookLangs)
        for (const l of LANGUAGES) {
          const v = selectedVoices[l.code]
          if (v) localStorage.setItem(`wstory_${l.code}_voice`, v)
          else localStorage.removeItem(`wstory_${l.code}_voice`)
        }
      }
      setDirty(false)
      onClose()
    } catch (err) { showMsg('error', err instanceof Error ? err.message : t('admin.saveFail')) }
    finally { setLlmSaving(false) }
  }
  const imageGenKeys = keys.filter((k) => k.supportsImageGen)
  const voicesByLang: Record<LangCode, SpeechSynthesisVoice[]> = LANGUAGES.reduce(
    (acc, l) => {
      acc[l.code] = allVoices.filter((v) => v.lang.toLowerCase().startsWith(l.ttsPrefix))
      return acc
    },
    {} as Record<LangCode, SpeechSynthesisVoice[]>,
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: '860px', maxWidth: 'calc(100vw - 2rem)', height: '600px', maxHeight: '90vh' }}>

        {/* Header */}
        <header className="bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="font-bold text-gray-800 text-lg">{t('admin.title')}</h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
        </header>

        {/* Toast */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {message.text}
          </div>
        )}

        {/* Scroll area */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 py-6 flex flex-col">

          {/* Tabs */}
          <div className="flex items-center mb-6 flex-shrink-0">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {([['llm', t('admin.tabLlm')], ['tts', t('admin.tabTts')]] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setAdminTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {adminTab === 'llm' && (
          <div className="space-y-6 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.storyModel')}</label>
                <select value={llm.storyLLMId} onChange={(e) => setLlm({ ...llm, storyLLMId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">{t('admin.selectApiKey')}</option>
                  {keys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.model || k.provider})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">{t('admin.storyModelHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.pictureModel')}</label>
                <select value={llm.pictureLLMId} onChange={(e) => setLlm({ ...llm, pictureLLMId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">{t('admin.selectApiKey')}</option>
                  {imageGenKeys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.model || k.provider})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">{t('admin.pictureModelHint')}</p>
              </div>
            </div>

            {/* API Keys */}
            <div>
              <div className="mb-4">
                <button onClick={openAddKey} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  {t('admin.addApiKey')}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {[t('admin.colName'), t('admin.colProvider'), t('admin.colModel'), t('admin.colImageGen'), t('admin.colActions')].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {keys.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">{t('admin.noKeys')}</td></tr>
                    ) : keys.map((k) => (
                        <tr key={k.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{k.name}</td>
                          <td className="px-4 py-3 text-gray-600">{k.provider || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{k.model || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${k.supportsImageGen ? 'text-green-500' : 'text-gray-400'}`}>{k.supportsImageGen ? t('admin.imageGenYes') : t('admin.imageGenNo')}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditKey(k)} className="text-blue-500 hover:text-blue-700 text-xs font-medium transition-colors">{t('admin.edit')}</button>
                              <button onClick={() => handleDeleteKey(k.id)} className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">{t('admin.delete')}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            </div>

          </div>
          )}

          {adminTab === 'tts' && (
          <div className="flex flex-col gap-5 flex-1 min-h-0">
            <p className="text-xs text-gray-500 leading-relaxed flex-shrink-0">{t('admin.bookLangsHint')}</p>
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold w-12 bg-gray-50">
                        <span className="sr-only">{t('admin.colBookLang')}</span>
                      </th>
                      <th className="px-4 py-3 text-left font-semibold bg-gray-50 whitespace-nowrap">{t('admin.colBookLang')}</th>
                      <th className="px-4 py-3 text-left font-semibold bg-gray-50 whitespace-nowrap">{t('admin.colVoice')}</th>
                      <th className="px-4 py-3 text-center font-semibold w-20 bg-gray-50 whitespace-nowrap">{t('admin.colTest')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {LANGUAGES.map((lang) => {
                      const voices = voicesByLang[lang.code] ?? []
                      const checked = bookLangs.includes(lang.code)
                      const isLastChecked = checked && bookLangs.length === 1
                      const currentVoiceName = selectedVoices[lang.code] ?? ''
                      const testPhrases: Record<LangCode, string> = {
                        zh: '测试语音效果',
                        en: 'Testing voice output',
                        ja: 'テスト音声です',
                        ko: '음성 테스트입니다',
                        fr: 'Test de la voix',
                        fi: 'Testataan ääntä',
                        es: 'Probando la voz',
                        pt: 'Testando a voz',
                        de: 'Teste die Stimme',
                        pl: 'Testowanie głosu',
                        it: 'Test della voce',
                        ar: 'اختبار الصوت',
                        da: 'Test af lyden',
                        hi: 'आवाज़ का परीक्षण',
                        th: 'ทดสอบเสียง',
                        ru: 'Тестирование голоса',
                        el: 'Δοκιμή φωνής',
                        ms: 'Ujian suara',
                      }
                      return (
                        <tr key={lang.code} className={checked ? '' : 'opacity-60'}>
                          {/* 列1：复选框 — 选中后才生成该语言文字、朗读下拉才显示 */}
                          <td className="px-4 py-3 align-middle bg-white">
                            <input type="checkbox" checked={checked} disabled={isLastChecked}
                              onChange={() => toggleBookLang(lang.code)}
                              className="w-4 h-4 accent-purple-600 cursor-pointer disabled:cursor-not-allowed"
                              title={t('admin.colBookLang')} />
                          </td>
                          {/* 列2：语言名 */}
                          <td className="px-4 py-3 align-middle font-semibold text-gray-800 bg-white whitespace-nowrap">
                            {lang.i18nLabel[locale]}
                          </td>
                          {/* 列3：该语言的语音下拉（单选） */}
                          <td className="px-4 py-3 align-middle bg-white">
                            {voices.length === 0 ? (
                              <span className="text-xs text-gray-400">{t(`admin.no${lang.fieldSuffix || 'Zh'}Voice`)}</span>
                            ) : (
                              <select value={currentVoiceName}
                                onChange={(e) => setVoiceFor(lang.code, e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                                <option value="">{t('admin.defaultVoice')}</option>
                                {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                              </select>
                            )}
                          </td>
                          {/* 列4：测试按钮 — 测试本行当前选中的语音 */}
                          <td className="px-4 py-3 align-middle text-center bg-white">
                            <button type="button" disabled={voices.length === 0}
                              onClick={() => {
                                speechSynthesis.cancel()
                                const stored = currentVoiceName || undefined
                                const voice = stored
                                  ? allVoices.find((v) => v.name === stored) ?? pickVoiceForLang(allVoices, lang.code, stored)
                                  : pickVoiceForLang(allVoices, lang.code)
                                setTimeout(() => {
                                  const utt = new SpeechSynthesisUtterance(testPhrases[lang.code])
                                  utt.voice = voice; utt.rate = 0.9
                                  speechSynthesis.speak(utt)
                                }, 100)
                              }}
                              title={t('admin.testVoice')}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}



        </div>{/* end scroll area */}

        <footer className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium py-2.5 px-5 rounded-xl transition-colors text-sm">
            {t('admin.cancel')}
          </button>
          <button type="button" onClick={handlePersistConfig} disabled={llmSaving || !dirty}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm">
            {llmSaving ? t('admin.saving') : t('admin.saveBtn')}
          </button>
        </footer>

        {/* API Key Modal */}
        {keyModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">{editingKey ? t('admin.keyTitleEdit') : t('admin.keyTitleAdd')}</h3>
                <button onClick={closeKeyModal} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
              </div>
              <form onSubmit={handleKeySubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('admin.keyProvider')}</label>
                  <select value={form.provider}
                    onChange={(e) => {
                      const preset = PROVIDER_PRESETS.find((p) => p.provider === e.target.value)
                      if (preset) setForm((f) => ({ ...f, provider: preset.provider, model: preset.model || f.model, baseURL: preset.baseURL || f.baseURL }))
                      else setForm((f) => ({ ...f, provider: e.target.value }))
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                    {PROVIDER_PRESETS.map((p) => (
                      <option key={p.labelKey} value={p.provider}>{t(p.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('admin.keyName')} <span className="text-red-400">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 我的 GPT-4o"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('admin.keyModel')}</label>
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. gpt-4o"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('admin.keyBaseURL')}</label>
                  <input value={form.baseURL} onChange={(e) => setForm({ ...form, baseURL: e.target.value })} placeholder="https://api.openai.com/v1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {t('admin.keySecret')}
                    {editingKey && !isDraftKeyId(editingKey.id) && <span className="ml-1 font-normal text-gray-400">{t('admin.keySecretHint')}</span>}
                  </label>
                  <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.supportsImageGen} onChange={(e) => setForm({ ...form, supportsImageGen: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-300" />
                  <span className="text-sm text-gray-700">{t('admin.keyImageGen')}</span>
                </label>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeKeyModal} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">{t('admin.cancel')}</button>
                  <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                    {t('admin.ok')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
