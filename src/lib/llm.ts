import OpenAI from 'openai'
import { getActiveLLMKey } from './configStore'
import { decrypt } from './crypto'
import type { APIKey } from '@/types'

function isDeepSeek(apiKey: APIKey): boolean {
  return apiKey.provider === 'deepseek'
}

function createClientFromKey(apiKey: APIKey): OpenAI {
  let plainKey = ''
  try {
    plainKey = decrypt(apiKey.keyEncrypted)
  } catch {
    plainKey = 'invalid'
  }
  return new OpenAI({
    apiKey: plainKey,
    baseURL: apiKey.baseURL || undefined,
    timeout: 120000,
    maxRetries: 2,
  })
}

function cleanJSON(content: string): string {
  // Strip markdown code fences
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return repairJSON(fenced[1].trim())
  // Extract first {...} or [...] block
  const obj = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (obj) return repairJSON(obj[1].trim())
  return repairJSON(content.trim())
}

// Fix common LLM JSON output issues: unescaped control characters inside string values
function repairJSON(raw: string): string {
  // Replace unescaped newlines/tabs/carriage-returns inside JSON string values
  // Walk char-by-char tracking whether we're inside a string
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      result += ch
      continue
    }
    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }
    if (inString) {
      if (ch === '\n')       { result += '\\n'; continue }
      if (ch === '\r')       { result += '\\r'; continue }
      if (ch === '\t')       { result += '\\t'; continue }
      // Strip other control characters
      if (ch.charCodeAt(0) < 0x20) continue
    }
    result += ch
  }
  return result
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  llmType: 'story' | 'picture' = 'story',
  maxTokens?: number,
): Promise<T> {
  const keyConfig = getActiveLLMKey(llmType)
  if (!keyConfig) {
    throw new Error(
      `未配置${llmType === 'story' ? '故事' : '绘本'} LLM，请在管理后台 → LLM 设置 中配置`,
    )
  }
  const client = createClientFromKey(keyConfig)

  const systemContent = isDeepSeek(keyConfig)
    ? systemPrompt + '\n\n请严格以 JSON 格式返回，不要包含任何其他文字或 markdown。'
    : systemPrompt + '\n\n请只返回 JSON，不要任何其他文字或 markdown 代码块。'

  const requestParams: Parameters<typeof client.chat.completions.create>[0] = {
    model: keyConfig.model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userPrompt },
    ],
    ...(isDeepSeek(keyConfig) && {
      response_format: { type: 'json_object' },
      max_tokens: maxTokens ?? 4096,
    }),
    ...(maxTokens && !isDeepSeek(keyConfig) && { max_tokens: maxTokens }),
  }

  const response = await client.chat.completions.create(requestParams)
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('LLM 返回了空内容')
  return JSON.parse(cleanJSON(content)) as T
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  llmType: 'story' | 'picture' = 'picture',
): Promise<string> {
  const keyConfig = getActiveLLMKey(llmType)
  if (!keyConfig) {
    throw new Error(
      `未配置${llmType === 'story' ? '故事' : '绘本'} LLM，请在管理后台 → LLM 设置 中配置`,
    )
  }
  const client = createClientFromKey(keyConfig)
  const response = await client.chat.completions.create({
    model: keyConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  return response.choices[0]?.message?.content?.trim() || ''
}
