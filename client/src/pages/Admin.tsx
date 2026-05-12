import { useState, useEffect } from 'react'
import type { APIKeyView, APIKeyInput, LLMSettings, PromptTemplate } from '@/types'

type Tab = 'apikeys' | 'llm' | 'prompts'
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

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('apikeys')
  const [message, setMessage] = useState<Message | null>(null)

  // ── API Keys ──
  const [keys, setKeys] = useState<APIKeyView[]>([])
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<APIKeyView | null>(null)
  const [form, setForm] = useState<APIKeyFormData>(EMPTY_FORM)
  const [keySaving, setKeySaving] = useState(false)

  // ── LLM Settings ──
  const [llm, setLlm] = useState<LLMSettings>({ storyLLMId: '', pictureLLMId: '' })
  const [llmSaving, setLlmSaving] = useState(false)

  // ── Prompts ──
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null)
  const [promptForm, setPromptForm] = useState<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'meta' | 'type'> & { type: string }>({ name: '', type: '', systemPrompt: '', userPromptTemplate: '' })
  const [promptSaving, setPromptSaving] = useState(false)

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  useEffect(() => {
    fetch('/api/admin/api-keys').then((r) => r.ok ? r.json() : []).then(setKeys)
    fetch('/api/admin/llm-settings').then((r) => r.ok ? r.json() : null).then((d: LLMSettings | null) => { if (d && d.storyLLMId !== undefined) setLlm(d) })
    fetch('/api/admin/prompts').then((r) => r.ok ? r.json() : []).then(setPrompts)
  }, [])

  // ── API Key handlers ──
  const openAddKey = () => { setEditingKey(null); setForm(EMPTY_FORM); setKeyModalOpen(true) }
  const openEditKey = (k: APIKeyView) => { setEditingKey(k); setForm({ name: k.name, provider: k.provider ?? '', model: k.model ?? '', baseURL: k.baseURL ?? '', apiKey: '', supportsImageGen: k.supportsImageGen }); setKeyModalOpen(true) }
  const closeKeyModal = () => { setKeyModalOpen(false); setEditingKey(null); setForm(EMPTY_FORM) }
  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { showMsg('error', '请填写名称'); return }
    setKeySaving(true)
    try {
      const body: Partial<APIKeyInput> = { name: form.name, provider: form.provider, model: form.model, baseURL: form.baseURL, supportsImageGen: form.supportsImageGen }
      if (form.apiKey) body.apiKey = form.apiKey
      const url = editingKey ? `/api/admin/api-keys/${editingKey.id}` : '/api/admin/api-keys'
      const method = editingKey ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await fetch('/api/admin/api-keys').then((r) => r.json())
      setKeys(updated)
      closeKeyModal()
      showMsg('success', editingKey ? 'API Key 已更新' : 'API Key 已添加')
    } catch (err) { showMsg('error', err instanceof Error ? err.message : '操作失败') }
    finally { setKeySaving(false) }
  }
  const handleDeleteKey = async (id: string) => {
    if (!confirm('确认删除此 API Key？')) return
    const res = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
    if (res.ok) { setKeys((prev) => prev.filter((k) => k.id !== id)); showMsg('success', '已删除') }
    else showMsg('error', '删除失败')
  }

  // ── LLM Settings handlers ──
  const handleSaveLlm = async () => {
    setLlmSaving(true)
    try {
      const res = await fetch('/api/admin/llm-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(llm) })
      if (!res.ok) throw new Error((await res.json()).error)
      showMsg('success', '设置已保存')
    } catch (err) { showMsg('error', err instanceof Error ? err.message : '保存失败') }
    finally { setLlmSaving(false) }
  }

  // ── Prompt handlers ──
  const openAddPrompt = () => { setEditingPrompt(null); setPromptForm({ name: '', type: '', systemPrompt: '', userPromptTemplate: '' }) }
  const openEditPrompt = (p: PromptTemplate) => { setEditingPrompt(p); setPromptForm({ name: p.name, type: p.type, systemPrompt: p.systemPrompt, userPromptTemplate: p.userPromptTemplate }) }
  const cancelPrompt = () => { setEditingPrompt(null); setPromptForm({ name: '', type: '', systemPrompt: '', userPromptTemplate: '' }) }
  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promptForm.name || !promptForm.type) { showMsg('error', '请填写名称和类型'); return }
    setPromptSaving(true)
    try {
      const body = editingPrompt ? { id: editingPrompt.id, ...promptForm } : promptForm
      const res = await fetch(editingPrompt ? `/api/admin/prompts/${editingPrompt.id}` : '/api/admin/prompts', {
        method: editingPrompt ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await fetch('/api/admin/prompts').then((r) => r.json())
      setPrompts(updated)
      cancelPrompt()
      showMsg('success', editingPrompt ? '提示词已更新' : '提示词已添加')
    } catch (err) { showMsg('error', err instanceof Error ? err.message : '保存失败') }
    finally { setPromptSaving(false) }
  }
  const handleDeletePrompt = async (id: string) => {
    if (!confirm('确认删除此提示词模板？')) return
    const res = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' })
    if (res.ok) { setPrompts((prev) => prev.filter((p) => p.id !== id)); showMsg('success', '已删除') }
    else showMsg('error', '删除失败')
  }

  const imageGenKeys = keys.filter((k) => k.supportsImageGen)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="font-bold text-gray-800 text-lg">系统设置</h1>
      </header>

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
          {([['apikeys', 'API Keys'], ['llm', 'LLM 配置'], ['prompts', '提示词模板']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: API Keys ── */}
        {tab === 'apikeys' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">API Key 管理</h2>
              <button onClick={openAddKey} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                添加 API Key
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {keys.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">暂无 API Key，点击右上角添加</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['名称', '提供商', '模型', 'Base URL', 'API Key', '图像生成', '操作'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{k.name}</td>
                        <td className="px-4 py-3 text-gray-600">{k.provider || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{k.model || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate" title={k.baseURL}>{k.baseURL || '—'}</td>
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{k.keyMasked}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block w-2 h-2 rounded-full ${k.supportsImageGen ? 'bg-green-400' : 'bg-gray-300'}`} />
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
              )}
            </div>
          </div>
        )}

        {/* ── Tab: LLM Settings ── */}
        {tab === 'llm' && (
          <div className="max-w-lg">
            <h2 className="font-semibold text-gray-800 mb-4">LLM 配置</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">故事生成模型</label>
                <select value={llm.storyLLMId} onChange={(e) => setLlm({ ...llm, storyLLMId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">-- 选择 API Key --</option>
                  {keys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.model || k.provider})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">用于生成绘本故事文字内容</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">绘图模型</label>
                <select value={llm.pictureLLMId} onChange={(e) => setLlm({ ...llm, pictureLLMId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                  <option value="">-- 选择 API Key --</option>
                  {imageGenKeys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.model || k.provider})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1.5">仅显示支持图像生成的 Key（需在 API Keys 中勾选）</p>
              </div>
              <button onClick={handleSaveLlm} disabled={llmSaving}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                {llmSaving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Prompts ── */}
        {tab === 'prompts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">提示词模板</h2>
              {!editingPrompt && !promptForm.name && (
                <button onClick={openAddPrompt} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  添加模板
                </button>
              )}
            </div>

            {/* Edit / Add form */}
            {(editingPrompt !== null || promptForm.name !== '' || promptForm.type !== '') && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6 space-y-4">
                <h3 className="font-semibold text-gray-700 text-sm">{editingPrompt ? '编辑提示词' : '新增提示词'}</h3>
                <form onSubmit={handleSavePrompt} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">名称</label>
                      <input value={promptForm.name} onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })} placeholder="e.g. 故事生成"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">类型</label>
                      <input value={promptForm.type} onChange={(e) => setPromptForm({ ...promptForm, type: e.target.value })} placeholder="e.g. story"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">系统提示词</label>
                    <textarea value={promptForm.systemPrompt} onChange={(e) => setPromptForm({ ...promptForm, systemPrompt: e.target.value })} rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">用户提示词模板</label>
                    <textarea value={promptForm.userPromptTemplate} onChange={(e) => setPromptForm({ ...promptForm, userPromptTemplate: e.target.value })} rows={5}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none font-mono" />
                    <p className="text-xs text-gray-400 mt-1">支持 {'{variable}'} 占位符</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={cancelPrompt} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">取消</button>
                    <button type="submit" disabled={promptSaving} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                      {promptSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Prompts list */}
            <div className="space-y-2">
              {prompts.length === 0 && !(editingPrompt !== null || promptForm.name !== '') && (
                <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
                  暂无提示词模板，将使用内置默认模板
                </div>
              )}
              {prompts.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                    <span className="ml-2 bg-purple-100 text-purple-600 text-xs px-2 py-0.5 rounded-full">{p.type}</span>
                    <p className="text-xs text-gray-400 mt-0.5">更新于 {new Date(p.updatedAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => openEditPrompt(p)} className="text-blue-500 hover:text-blue-700 text-xs font-medium transition-colors">编辑</button>
                    <button onClick={() => handleDeletePrompt(p.id)} className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── API Key Modal ── */}
      {keyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editingKey ? '编辑 API Key' : '添加 API Key'}</h3>
              <button onClick={closeKeyModal} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleKeySubmit} className="px-6 py-5 space-y-4">
              {/* Provider dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">LLM 提供商</label>
                <select
                  value={form.provider}
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Base URL</label>
                <input value={form.baseURL} onChange={(e) => setForm({ ...form, baseURL: e.target.value })} placeholder="https://api.openai.com/v1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  API Key
                  {editingKey && <span className="ml-1 font-normal text-gray-400">（留空则保留原值）</span>}
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
                <button type="submit" disabled={keySaving} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                  {keySaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
