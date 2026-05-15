import { v4 as uuidv4 } from 'uuid'
import { readJson, writeJson } from './storage'
import { encrypt, decrypt, maskKey } from './crypto'
import type { AppConfig, APIKey, APIKeyInput, APIKeyView, LLMSettings, AdminPersistApiKeyInput } from '@/types'

const FILENAME = 'config.json'

/**
 * 管理端：API Key / LLM 的完整变更应通过 applyFullAdminPersist（POST /api/admin/config/persist）一次写入内存并落盘。
 * createAPIKey / updateAPIKey / deleteAPIKey 仍可供内部或其它入口复用。
 */
const DEFAULT_CONFIG: AppConfig = {
  apiKeys: [],
  llmSettings: {
    storyLLMId: '',
    pictureLLMId: '',
  },
}

function getConfig(): AppConfig {
  return readJson<AppConfig>(FILENAME, DEFAULT_CONFIG)
}

/** 将当前内存中的完整配置写入 config.json */
export function persistAppConfigToFile(): void {
  writeJson(FILENAME, getConfig())
}

// ── API Keys ──

export function getAPIKeys(): APIKey[] {
  return getConfig().apiKeys
}

export function getAPIKeyById(id: string): APIKey | undefined {
  return getAPIKeys().find((k) => k.id === id)
}

function toView(k: APIKey): APIKeyView {
  let keyMasked = '****'
  try {
    keyMasked = maskKey(decrypt(k.keyEncrypted))
  } catch {}
  return {
    id: k.id,
    name: k.name,
    provider: k.provider,
    model: k.model,
    baseURL: k.baseURL,
    keyMasked,
    supportsImageGen: k.supportsImageGen,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  }
}

export function getAPIKeyViews(): APIKeyView[] {
  return getAPIKeys().map(toView)
}

export function createAPIKey(input: APIKeyInput): APIKeyView {
  const config = getConfig()
  const now = new Date().toISOString()
  const newKey: APIKey = {
    id: uuidv4(),
    name: input.name.trim(),
    provider: input.provider.trim(),
    model: input.model.trim(),
    baseURL: input.baseURL?.trim() || undefined,
    keyEncrypted: encrypt(input.apiKey),
    supportsImageGen: Boolean(input.supportsImageGen),
    createdAt: now,
    updatedAt: now,
  }
  config.apiKeys.push(newKey)
  // 第一个 key 自动设为故事 LLM；若支持文生图同时设为绘本 LLM
  if (config.apiKeys.length === 1) {
    config.llmSettings.storyLLMId = newKey.id
    if (newKey.supportsImageGen) {
      config.llmSettings.pictureLLMId = newKey.id
    }
  }
  return toView(newKey)
}

export function updateAPIKey(id: string, input: Partial<APIKeyInput>): APIKeyView | null {
  const config = getConfig()
  const idx = config.apiKeys.findIndex((k) => k.id === id)
  if (idx < 0) return null
  const existing = config.apiKeys[idx]
  const updated: APIKey = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    provider: input.provider?.trim() ?? existing.provider,
    model: input.model?.trim() ?? existing.model,
    baseURL:
      input.baseURL !== undefined
        ? input.baseURL.trim() || undefined
        : existing.baseURL,
    supportsImageGen:
      input.supportsImageGen !== undefined
        ? Boolean(input.supportsImageGen)
        : existing.supportsImageGen,
    // 只有提供了新 apiKey 才更新加密值
    keyEncrypted: input.apiKey ? encrypt(input.apiKey) : existing.keyEncrypted,
    updatedAt: new Date().toISOString(),
  }
  config.apiKeys[idx] = updated
  return toView(updated)
}

export function deleteAPIKey(id: string): boolean {
  const config = getConfig()
  const filtered = config.apiKeys.filter((k) => k.id !== id)
  if (filtered.length === config.apiKeys.length) return false
  config.apiKeys = filtered
  if (config.llmSettings.storyLLMId === id) config.llmSettings.storyLLMId = ''
  if (config.llmSettings.pictureLLMId === id) config.llmSettings.pictureLLMId = ''
  return true
}

// ── LLM Settings ──

export function getLLMSettings(): LLMSettings {
  return getConfig().llmSettings
}

export function updateLLMSettings(settings: Partial<LLMSettings>): LLMSettings {
  const config = getConfig()
  config.llmSettings = { ...config.llmSettings, ...settings }
  return config.llmSettings
}

const NEW_ROW_PREFIX = 'new_'

/**
 * 管理端「保存配置」：用请求体中的 apiKeys + llmSettings 整体替换内存中的对应字段并写入 config.json。
 * rowId 为已有 key 的 id，或以 `new_` 开头的草稿 id（保存时分配服务端 uuid）；llmSettings 中的 id 可与草稿 rowId 一致。
 */
export function applyFullAdminPersist(payload: { apiKeys: AdminPersistApiKeyInput[]; llmSettings: LLMSettings }): void {
  const config = getConfig()
  const oldById = new Map(config.apiKeys.map((k) => [k.id, k]))
  const rowIdToServerId = new Map<string, string>()

  for (const row of payload.apiKeys) {
    if (oldById.has(row.rowId)) {
      rowIdToServerId.set(row.rowId, row.rowId)
    } else if (row.rowId.startsWith(NEW_ROW_PREFIX)) {
      rowIdToServerId.set(row.rowId, uuidv4())
    } else {
      throw new Error('INVALID_ROW_ID')
    }
  }

  const now = new Date().toISOString()
  const newKeys: APIKey[] = []
  for (const row of payload.apiKeys) {
    const serverId = rowIdToServerId.get(row.rowId)!
    if (oldById.has(row.rowId)) {
      const old = oldById.get(row.rowId)!
      const trimmedSecret = row.apiKey?.trim()
      newKeys.push({
        ...old,
        id: serverId,
        name: row.name.trim(),
        provider: row.provider.trim(),
        model: row.model.trim(),
        baseURL: row.baseURL !== undefined ? row.baseURL.trim() || undefined : old.baseURL,
        supportsImageGen: Boolean(row.supportsImageGen),
        keyEncrypted: trimmedSecret ? encrypt(trimmedSecret) : old.keyEncrypted,
        updatedAt: now,
      })
    } else {
      const trimmedSecret = row.apiKey?.trim() ?? ''
      newKeys.push({
        id: serverId,
        name: row.name.trim(),
        provider: row.provider.trim(),
        model: row.model.trim(),
        baseURL: row.baseURL?.trim() || undefined,
        keyEncrypted: encrypt(trimmedSecret),
        supportsImageGen: Boolean(row.supportsImageGen),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  config.apiKeys = newKeys

  const mapLlmId = (id: string): string => {
    if (!id) return ''
    if (rowIdToServerId.has(id)) return rowIdToServerId.get(id)!
    return newKeys.some((k) => k.id === id) ? id : ''
  }

  let storyLLMId = mapLlmId(payload.llmSettings.storyLLMId)
  let pictureLLMId = mapLlmId(payload.llmSettings.pictureLLMId)

  if (newKeys.length === 1) {
    const only = newKeys[0]
    if (!storyLLMId) storyLLMId = only.id
    if (!pictureLLMId && only.supportsImageGen) pictureLLMId = only.id
  }

  if (storyLLMId && !newKeys.some((k) => k.id === storyLLMId)) storyLLMId = ''
  if (pictureLLMId) {
    const pk = newKeys.find((k) => k.id === pictureLLMId)
    if (!pk) pictureLLMId = ''
    else if (!pk.supportsImageGen) throw new Error('PICTURE_LLM_NOT_IMAGE_CAPABLE')
  }

  config.llmSettings = { storyLLMId, pictureLLMId }
  persistAppConfigToFile()
}

// ── Resolve active LLM key for generation ──

export function getLLMStatus(): { hasStoryLLM: boolean; hasPictureLLM: boolean } {
  const config = getConfig()
  const hasStoryLLM = Boolean(config.llmSettings.storyLLMId && getAPIKeyById(config.llmSettings.storyLLMId))
  const hasPictureLLM = Boolean(config.llmSettings.pictureLLMId && getAPIKeyById(config.llmSettings.pictureLLMId))
  return { hasStoryLLM, hasPictureLLM }
}

export function getActiveLLMKey(type: 'story' | 'picture'): APIKey | null {
  const config = getConfig()
  const id =
    type === 'story' ? config.llmSettings.storyLLMId : config.llmSettings.pictureLLMId
  if (id) return getAPIKeyById(id) ?? null
  // Fallback: if picture LLM not configured, use story LLM
  if (type === 'picture' && config.llmSettings.storyLLMId) {
    return getAPIKeyById(config.llmSettings.storyLLMId) ?? null
  }
  return null
}
