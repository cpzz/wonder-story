import { readJson, writeJson } from './storage'
import { getDefaultPrompts } from './defaultPrompts'
import type { PromptTemplate } from '@/types'

const FILENAME = 'prompts.json'

export function getPrompts(): PromptTemplate[] {
  const stored = readJson<PromptTemplate[]>(FILENAME, [])
  const defaults = getDefaultPrompts()
  if (stored.length === 0) {
    writeJson(FILENAME, defaults)
    return defaults
  }
  // Always sync built-in default templates (id starts with 'default-') with latest code.
  // User-created templates (custom ids) are preserved as-is.
  let updated = false
  for (const def of defaults) {
    const idx = stored.findIndex((p) => p.id === def.id)
    if (idx < 0) {
      // Missing type — add it
      stored.push(def)
      updated = true
    } else if (stored[idx].id.startsWith('default-')) {
      // Built-in template — always overwrite with latest default content
      if (stored[idx].systemPrompt !== def.systemPrompt || stored[idx].userPromptTemplate !== def.userPromptTemplate) {
        stored[idx] = { ...def, updatedAt: new Date().toISOString() }
        updated = true
      }
    }
  }
  if (updated) writeJson(FILENAME, stored)
  return stored
}

export function getPromptById(id: string): PromptTemplate | undefined {
  return getPrompts().find((p) => p.id === id)
}

export function getPromptByType(type: PromptTemplate['type']): PromptTemplate | undefined {
  return getPrompts().find((p) => p.type === type)
}

export function upsertPrompt(prompt: PromptTemplate): void {
  const prompts = getPrompts()
  const idx = prompts.findIndex((p) => p.id === prompt.id)
  if (idx >= 0) {
    prompts[idx] = prompt
  } else {
    prompts.push(prompt)
  }
  writeJson(FILENAME, prompts)
}

export function deletePrompt(id: string): boolean {
  const prompts = getPrompts()
  const filtered = prompts.filter((p) => p.id !== id)
  if (filtered.length === prompts.length) return false
  writeJson(FILENAME, filtered)
  return true
}
