import { v4 as uuidv4 } from 'uuid'
import { readJson, writeJson } from './storage'
import { encrypt, decrypt, maskKey } from './crypto'
import type { AppConfig, APIKey, APIKeyInput, APIKeyView, LLMSettings } from '@/types'

const FILENAME = 'config.json'

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

function saveConfig(config: AppConfig): void {
  writeJson(FILENAME, config)
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
  saveConfig(config)
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
  saveConfig(config)
  return toView(updated)
}

export function deleteAPIKey(id: string): boolean {
  const config = getConfig()
  const filtered = config.apiKeys.filter((k) => k.id !== id)
  if (filtered.length === config.apiKeys.length) return false
  config.apiKeys = filtered
  if (config.llmSettings.storyLLMId === id) config.llmSettings.storyLLMId = ''
  if (config.llmSettings.pictureLLMId === id) config.llmSettings.pictureLLMId = ''
  saveConfig(config)
  return true
}

// ── LLM Settings ──

export function getLLMSettings(): LLMSettings {
  return getConfig().llmSettings
}

export function updateLLMSettings(settings: Partial<LLMSettings>): LLMSettings {
  const config = getConfig()
  config.llmSettings = { ...config.llmSettings, ...settings }
  saveConfig(config)
  return config.llmSettings
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
