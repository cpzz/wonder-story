import OpenAI from 'openai'
import { getActiveLLMKey } from './configStore'
import { decrypt } from './crypto'
import type { APIKey } from '@/types'

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
    timeout: 30000,
    maxRetries: 2,
  })
}

function cleanJSON(content: string): string {
  // Strip markdown code fences
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // Extract first {...} or [...] block
  const obj = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (obj) return obj[1].trim()
  return content.trim()
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  llmType: 'story' | 'picture' = 'story',
): Promise<T> {
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
      { role: 'system', content: systemPrompt + '\n\n请只返回 JSON，不要任何其他文字或 markdown 代码块。' },
      { role: 'user', content: userPrompt },
    ],
  })
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
