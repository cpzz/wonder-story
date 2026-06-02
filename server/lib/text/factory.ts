import { TextModelAdapter } from './textAdapter'
import { OpenAITextAdapter } from './openaiCompatibleAdapter'
import { ClaudeTextAdapter } from './claudeAdapter'

const textAdapterRegistry: Record<string, new () => TextModelAdapter> = {
  openai: OpenAITextAdapter,
  deepseek: OpenAITextAdapter,
  claude: ClaudeTextAdapter,
}

export function createTextAdapter(provider: string): TextModelAdapter {
  const AdapterClass = textAdapterRegistry[provider]
  if (!AdapterClass) {
    throw new Error(`不支持的文本模型提供商: ${provider}，当前支持: ${Object.keys(textAdapterRegistry).join(', ')}`)
  }
  return new AdapterClass()
}

export function getSupportedTextProviders(): string[] {
  return Object.keys(textAdapterRegistry)
}

export function registerTextAdapter(provider: string, adapterClass: new () => TextModelAdapter): void {
  textAdapterRegistry[provider] = adapterClass
}
