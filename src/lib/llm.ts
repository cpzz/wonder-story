import OpenAI from 'openai'
import { jsonrepair } from 'jsonrepair'
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

/**
 * 从首个 `{` 或 `[` 起按括号与字符串规则截取**一层**完整 JSON，避免 `/\{[\s\S]*\}/` 贪婪匹配到文末垃圾或另一段 `}`。
 */
function extractBalancedJson(text: string): string | null {
  const start = text.search(/[\[{]/)
  if (start < 0) return null
  const stack: ('{' | '[')[] = []
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') {
        inString = false
        continue
      }
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') {
      stack.push('{')
      continue
    }
    if (c === '[') {
      stack.push('[')
      continue
    }
    if (c === '}') {
      if (stack.length === 0 || stack[stack.length - 1] !== '{') return null
      stack.pop()
      if (stack.length === 0) return text.slice(start, i + 1)
      continue
    }
    if (c === ']') {
      if (stack.length === 0 || stack[stack.length - 1] !== '[') return null
      stack.pop()
      if (stack.length === 0) return text.slice(start, i + 1)
      continue
    }
  }
  return null
}

function cleanJSON(content: string): string {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const inner = fenced ? fenced[1].trim() : trimmed
  const balanced = extractBalancedJson(inner) ?? inner

  const attempts = [balanced, inner, trimmed]
  let lastErr: unknown
  for (const candidate of attempts) {
    if (!candidate) continue
    try {
      return jsonrepair(candidate)
    } catch (e) {
      lastErr = e
    }
  }
  const posNum =
    lastErr && typeof lastErr === 'object' && 'position' in lastErr
      ? (lastErr as { position: number }).position
      : -1
  const sample =
    posNum >= 0 ? balanced.slice(Math.max(0, posNum - 120), posNum + 120) : balanced.slice(0, 400)
  console.error('[cleanJSON] jsonrepair failed after balanced extract', { position: posNum, sample })
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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
    ? systemPrompt + '\n\n请严格以 JSON 格式返回，不要包含任何其他文字或markdown。'
    : systemPrompt + '\n\n请只返回JSON，不要任何其他文字或markdown代码块。'

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
  
  const cleaned = cleanJSON(content)
  try {
    return JSON.parse(cleaned) as T
  } catch (parseError) {
    console.error('[generateJSON] Failed to parse LLM response:', {
      raw: content,
      cleaned,
      error: parseError instanceof Error ? parseError.message : String(parseError),
    })
    throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
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
