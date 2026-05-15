import { useState, useEffect, useRef } from 'react'
import type { APIKeyView, LLMSettings } from '@/types'

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
  { label: '-- 自定义 --', provider: '', model: '', baseURL: '' },
  { label: 'OpenAI', provider: 'openai', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
  { label: 'Anthropic', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', baseURL: 'https://api.anthropic.com/v1' },
  { label: 'DeepSeek（深度求索）', provider: 'deepseek', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
  { label: '阿里云（通义千问）', provider: 'alibaba', model: 'qwen-max', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: '百度（文心一言）', provider: 'baidu', model: 'ernie-4.0-8k', baseURL: 'https://qianfan.baidubce.com/v2' },
  { label: '智谱 AI（GLM）', provider: 'zhipu', model: 'glm-4-flash', baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
  { label: '月之暗面（Moonshot）', provider: 'moonshot', model: 'moonshot-v1-8k', baseURL: 'https://api.moonshot.cn/v1' },
  { label: '字节跳动（豆包）', provider: 'bytedance', model: 'doubao-pro-4k', baseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
  { label: '移动云（cmecloud）', provider: 'cmecloud', model: '', baseURL: 'https://zhenze-huhehaote.cmecloud.cn/v1' },
]

export default function AdminPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState<Message | null>(null)
  const [adminTab, setAdminTab] = useState<'llm' | 'tts'>('llm')

  // ── API Keys ──
  const [keys, setKeys] = useState<LocalKeyRow[]>([])
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<LocalKeyRow | null>(null)
  const [form, setForm] = useState<APIKeyFormData>(EMPTY_FORM)

  // ── LLM Settings ──
  const [llm, setLlm] = useState<LLMSettings>({ storyLLMId: '', pictureLLMId: '' })
  const [llmSaving, setLlmSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const baselineRef = useRef<{ llm: LLMSettings; keysSig: string } | null>(null)
  const [baselineReady, setBaselineReady] = useState(false)

  // ── TTS Voices ──
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedZhVoice, setSelectedZhVoice] = useState(() => localStorage.getItem('wstory_zh_voice') ?? '')
  const [selectedEnVoice, setSelectedEnVoice] = useState(() => localStorage.getItem('wstory_en_voice') ?? '')

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  /** 每次打开设置窗口时从服务端 runtime 拉取最新 keys / llm，并重置本地基线与子模态 */
  useEffect(() => {
    if (!open) return
    setKeyModalOpen(false)
    setEditingKey(null)
    setForm(EMPTY_FORM)
    setMessage(null)
    setAdminTab('llm')
    setBaselineReady(false)
    let cancelled = false
    ;(async () => {
      try {
        const [kRes, lRes] = await Promise.all([fetch('/api/admin/api-keys'), fetch('/api/admin/llm-settings')])
        const keyList: APIKeyView[] = kRes.ok ? await kRes.json() : []
        const llmData: LLMSettings | null = lRes.ok ? await lRes.json() : null
        if (cancelled) return
        setKeys(keyList.map((k) => ({ ...k })))
        if (llmData && llmData.storyLLMId !== undefined) {
          const next: LLMSettings = {
            storyLLMId: llmData.storyLLMId,
            pictureLLMId: llmData.pictureLLMId ?? '',
          }
          setLlm(next)
          baselineRef.current = { llm: next, keysSig: keysSnapshot(keyList) }
        } else {
          baselineRef.current = { llm: { storyLLMId: '', pictureLLMId: '' }, keysSig: keysSnapshot(keyList) }
        }
        setBaselineReady(true)
      } catch {
        if (!cancelled) setBaselineReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open || !baselineReady || !baselineRef.current) return
    const b = baselineRef.current
    const llmDirty = llm.storyLLMId !== b.llm.storyLLMId || llm.pictureLLMId !== b.llm.pictureLLMId
    const keysDirty = keysSnapshot(keys) !== b.keysSig
    setDirty(llmDirty || keysDirty)
  }, [open, keys, llm, baselineReady])

  useEffect(() => {
    const load = () => setAllVoices(speechSynthesis.getVoices())
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // ── API Key handlers ──
  const openAddKey = () => { setEditingKey(null); setForm(EMPTY_FORM); setKeyModalOpen(true) }
  const openEditKey = (k: LocalKeyRow) => { setEditingKey(k); setForm({ name: k.name, provider: k.provider ?? '', model: k.model ?? '', baseURL: k.baseURL ?? '', apiKey: '', supportsImageGen: k.supportsImageGen }); setKeyModalOpen(true) }
  const closeKeyModal = () => { setKeyModalOpen(false); setEditingKey(null); setForm(EMPTY_FORM) }
  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { showMsg('error', '请填写名称'); return }
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
        keyMasked: secret ? '（待保存）' : '（未填写）',
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
        next.keyMasked = '（待保存）'
      } else if (!isDraftKeyId(row.id)) {
        delete next.pendingApiKey
      }
      return next
    }))
    closeKeyModal()
  }
  const handleDeleteKey = (id: string) => {
    if (!confirm('确认删除此 API Key？')) return
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
      let errMsg = '保存失败'
      if (!res.ok) {
        try {
          const j = await res.json()
          if (typeof j.error === 'string') errMsg = j.error
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }
      if (baselineRef.current) {
        baselineRef.current = { llm: { ...llm }, keysSig: keysSnapshot(keys) }
      }
      setDirty(false)
      onClose()
    } catch (err) { showMsg('error', err instanceof Error ? err.message : '保存失败') }
    finally { setLlmSaving(false) }
  }
  const imageGenKeys = keys.filter((k) => k.supportsImageGen)
  const zhVoices = allVoices.filter((v) => v.lang.startsWith('zh'))
  const enVoices = allVoices.filter((v) => v.lang.startsWith('en'))

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-50 rounded-2xl shadow-2xl flex flex-col" style={{ width: '860px', height: '600px' }}>

        {/* Header */}
        <header className="bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="font-bold text-gray-800 text-lg">系统设置</h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
        </header>

        {/* Toast */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {message.text}
          </div>
        )}

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* Tabs */}
          <div className="flex items-center mb-6">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {([['llm', '大模型配置'], ['tts', '朗读设置']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setAdminTab(t)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {adminTab === 'llm' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">故事生成模型</label>
                <select value={llm.storyLLMId} onChange={(e) => setLlm({ ...llm, storyLLMId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">-- 选择 API Key --</option>
                  {keys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.model || k.provider})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">用于生成故事文字 + 图片描述</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">绘本图片模型</label>
                <select value={llm.pictureLLMId} onChange={(e) => setLlm({ ...llm, pictureLLMId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">-- 选择 API Key --</option>
                  {imageGenKeys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.model || k.provider})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">用于生成绘本插画（如 qwen-image-edit-plus）</p>
              </div>
            </div>

            {/* API Keys */}
            <div>
              <div className="mb-4">
                <button onClick={openAddKey} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  添加 API Key
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['名称', '提供商', '模型', '图像生成', '操作'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {keys.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">暂无 API Key，点击上方按钮添加</td></tr>
                    ) : keys.map((k) => (
                        <tr key={k.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{k.name}</td>
                          <td className="px-4 py-3 text-gray-600">{k.provider || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{k.model || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${k.supportsImageGen ? 'text-green-500' : 'text-gray-400'}`}>{k.supportsImageGen ? '支持' : '不支持'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditKey(k)} className="text-blue-500 hover:text-blue-700 text-xs font-medium transition-colors">编辑</button>
                              <button onClick={() => handleDeleteKey(k.id)} className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">删除</button>
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
          <div className="space-y-5">
            <p className="text-xs text-gray-400">在此选择朗读时使用的语音，选择会立即生效。语音列表由浏览器提供。</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">中文语音</label>
                {zhVoices.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">未检测到中文语音</p>
                ) : (
                  <div className="flex gap-2">
                    <select value={selectedZhVoice}
                      onChange={(e) => { setSelectedZhVoice(e.target.value); localStorage.setItem('wstory_zh_voice', e.target.value) }}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                      <option value="">-- 使用默认 --</option>
                      {zhVoices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                    </select>
                    <button type="button" onClick={() => {
                      speechSynthesis.cancel()
                      const voice = selectedZhVoice ? allVoices.find((v) => v.name === selectedZhVoice) ?? null : allVoices.find((v) => v.lang.startsWith('zh')) ?? null
                      setTimeout(() => {
                        const utt = new SpeechSynthesisUtterance('测试语音效果')
                        utt.voice = voice; utt.rate = 0.9
                        speechSynthesis.speak(utt)
                      }, 100)
                    }} className="flex-shrink-0 border border-purple-200 text-purple-600 hover:bg-purple-50 text-sm px-4 py-3 rounded-xl transition-colors whitespace-nowrap">
                      ▶ 测试语音
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">英文语音</label>
                {enVoices.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">未检测到英文语音</p>
                ) : (
                  <div className="flex gap-2">
                    <select value={selectedEnVoice}
                      onChange={(e) => { setSelectedEnVoice(e.target.value); localStorage.setItem('wstory_en_voice', e.target.value) }}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                      <option value="">-- 使用默认 --</option>
                      {enVoices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                    </select>
                    <button type="button" onClick={() => {
                      speechSynthesis.cancel()
                      const voice = selectedEnVoice ? allVoices.find((v) => v.name === selectedEnVoice) ?? null : allVoices.find((v) => v.lang.startsWith('en')) ?? null
                      setTimeout(() => {
                        const utt = new SpeechSynthesisUtterance('Testing voice output')
                        utt.voice = voice; utt.rate = 0.9
                        speechSynthesis.speak(utt)
                      }, 100)
                    }} className="flex-shrink-0 border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm px-4 py-3 rounded-xl transition-colors whitespace-nowrap">
                      ▶ 测试语音
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}



        </div>{/* end scroll area */}

        <footer className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium py-2.5 px-5 rounded-xl transition-colors text-sm">
            取消
          </button>
          <button type="button" onClick={handlePersistConfig} disabled={llmSaving || !dirty}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm">
            {llmSaving ? '保存中...' : '保存设置'}
          </button>
        </footer>

        {/* API Key Modal */}
        {keyModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">{editingKey ? '编辑 API 密钥' : '添加 API 密钥'}</h3>
                <button onClick={closeKeyModal} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
              </div>
              <form onSubmit={handleKeySubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">大模型提供商</label>
                  <select value={form.provider}
                    onChange={(e) => {
                      const preset = PROVIDER_PRESETS.find((p) => p.provider === e.target.value)
                      if (preset) setForm((f) => ({ ...f, provider: preset.provider, model: preset.model || f.model, baseURL: preset.baseURL || f.baseURL }))
                      else setForm((f) => ({ ...f, provider: e.target.value }))
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                    {PROVIDER_PRESETS.map((p) => (
                      <option key={p.label} value={p.provider}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">名称 <span className="text-red-400">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 我的 GPT-4o"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">模型</label>
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. gpt-4o"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">服务地址</label>
                  <input value={form.baseURL} onChange={(e) => setForm({ ...form, baseURL: e.target.value })} placeholder="https://api.openai.com/v1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    API 密钥
                    {editingKey && !isDraftKeyId(editingKey.id) && <span className="ml-1 font-normal text-gray-400">（留空则保留原值）</span>}
                  </label>
                  <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.supportsImageGen} onChange={(e) => setForm({ ...form, supportsImageGen: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-300" />
                  <span className="text-sm text-gray-700">支持图像生成</span>
                </label>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeKeyModal} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                    确定
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
