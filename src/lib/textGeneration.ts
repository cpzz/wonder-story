import { getActiveLLMKey } from './configStore'
import { decrypt } from './crypto'
import { createTextAdapter } from '../../server/lib/text/factory'

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

  const plainKey = decrypt(keyConfig.keyEncrypted)
  const adapter = createTextAdapter(keyConfig.provider)

  return adapter.generateJSON<T>(systemPrompt, userPrompt, {
    apiKey: plainKey,
    model: keyConfig.model,
    baseURL: keyConfig.baseURL,
    provider: keyConfig.provider,
    maxTokens,
  })
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

  const plainKey = decrypt(keyConfig.keyEncrypted)
  const adapter = createTextAdapter(keyConfig.provider)

  return adapter.generateText(systemPrompt, userPrompt, {
    apiKey: plainKey,
    model: keyConfig.model,
    baseURL: keyConfig.baseURL,
    provider: keyConfig.provider,
  })
}
